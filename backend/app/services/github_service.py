import os
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
import httpx
from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

STOP_WORDS = {
    "agent", "ai", "project", "engine", "system", "app", "tool",
    "supervised", "governed", "autonomous", "self", "healing",
    "multi", "framework", "service", "the", "a", "an", "and", "or", "with"
}


def clean_project_name_for_matching(name: str) -> str:
    """Strips punctuation, hyphens, and common domain stop-words to focus on core identifiers"""
    if not name:
        return ""
    # Remove separators like dash, pipe, em-dash
    cleaned = re.sub(r"[\-–—|:–]", " ", name.lower())
    tokens = re.findall(r"\b[a-z0-9]+\b", cleaned)
    filtered = [t for t in tokens if t not in STOP_WORDS]
    if not filtered:
        # Fall back to original tokens if all were filtered
        filtered = tokens
    return " ".join(filtered)


class GitHubRepoSuggester:
    """
    Opt-in GitHub repository discovery and fuzzy matching service.
    Zero-Hallucination guarantee: Suggestions are distinctly labeled
    and must be explicitly confirmed by the user before saving.
    """

    @classmethod
    async def fetch_user_repositories(
        cls,
        username: str,
        token: Optional[str] = None,
        max_pages: int = 2
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetches public repositories for a GitHub user.
        Handles 403/404/rate limits gracefully.
        Returns: (repos_list, error_or_status_message)
        """
        if not username or not username.strip():
            return [], "GitHub username is required"

        clean_user = username.strip().rstrip("/").split("/")[-1].replace("@", "")
        gh_token = token or os.getenv("GITHUB_TOKEN") or os.getenv("GITHUB_API_TOKEN")

        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "JobPilot-App/1.0"
        }
        if gh_token:
            headers["Authorization"] = f"token {gh_token}"

        all_repos = []
        status_msg = None

        async with httpx.AsyncClient(timeout=10.0) as client:
            for page in range(1, max_pages + 1):
                url = f"https://api.github.com/users/{clean_user}/repos?per_page=100&sort=updated&page={page}"
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        repos = resp.json()
                        if not repos:
                            break
                        for r in repos:
                            all_repos.append({
                                "name": r.get("name", ""),
                                "full_name": r.get("full_name", ""),
                                "html_url": r.get("html_url", ""),
                                "description": r.get("description") or "",
                                "language": r.get("language") or "",
                                "stargazers_count": r.get("stargazers_count", 0),
                                "fork": r.get("fork", False)
                            })
                        if len(repos) < 100:
                            break
                    elif resp.status_code == 404:
                        logger.warning(f"GitHub user '{clean_user}' not found.")
                        return [], f"GitHub user '{clean_user}' was not found on GitHub."
                    elif resp.status_code == 403:
                        reset_header = resp.headers.get("X-RateLimit-Reset", "")
                        logger.warning(f"GitHub API rate limit exceeded: {resp.text}")
                        return all_repos, "GitHub rate limit reached. Please try again later or add your repo URL manually."
                    else:
                        logger.warning(f"GitHub API returned HTTP {resp.status_code}: {resp.text}")
                        return all_repos, f"GitHub returned status code {resp.status_code}."
                except Exception as e:
                    logger.error(f"Network error querying GitHub API: {e}", exc_info=True)
                    return all_repos, "Could not connect to GitHub API."

        return all_repos, None

    @classmethod
    def match_projects_to_repos(
        cls,
        projects: List[Dict[str, Any]],
        repos: List[Dict[str, Any]],
        threshold: float = 70.0
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fuzzy matches each project against user's GitHub repositories.
        Ignores generic stop-words and returns up to 3 candidates per project.
        """
        results: Dict[str, List[Dict[str, Any]]] = {}
        if not repos or not projects:
            return results

        for p in projects:
            p_title = p.get("title", "") if isinstance(p, dict) else getattr(p, "title", "")
            if not p_title:
                continue

            cleaned_title = clean_project_name_for_matching(p_title)
            candidates = []

            for r in repos:
                r_name = r.get("name", "")
                r_desc = r.get("description", "")
                cleaned_repo = clean_project_name_for_matching(r_name)

                # 1. Exact or partial token ratio on cleaned names
                score_name = fuzz.token_set_ratio(cleaned_title, cleaned_repo)
                score_partial = fuzz.partial_ratio(cleaned_title, cleaned_repo)
                score_raw = fuzz.partial_ratio(p_title.lower(), r_name.lower())

                # 2. Check description if present
                score_desc = 0.0
                if r_desc:
                    cleaned_desc = clean_project_name_for_matching(r_desc)
                    score_desc = fuzz.token_set_ratio(cleaned_title, cleaned_desc) * 0.85

                best_score = max(score_name, score_partial, score_raw, score_desc)

                # Bonus for exact slug containment
                slug_norm = r_name.replace("-", "").replace("_", "").lower()
                title_condensed = re.sub(r"[^a-z0-9]", "", p_title.lower())
                if slug_norm and (slug_norm in title_condensed or title_condensed in slug_norm):
                    best_score = max(best_score, 90.0)

                if best_score >= threshold:
                    candidates.append({
                        "repo_name": r_name,
                        "url": r.get("html_url", f"https://github.com/{r.get('full_name')}"),
                        "description": r_desc[:120] if r_desc else "",
                        "language": r.get("language") or "",
                        "score": round(best_score, 1),
                        "source": "github_suggestion"
                    })

            # Sort candidates by score descending and take top 3
            candidates.sort(key=lambda x: x["score"], reverse=True)
            results[p_title] = candidates[:3]

        return results


github_repo_suggester = GitHubRepoSuggester()
