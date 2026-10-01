// Shared Profile Mappers, Normalizers & Skill Hygiene Utility

export const SKILL_CATEGORIES = [
  { id: 'languages', label: 'Languages', placeholder: 'e.g. Python, TypeScript, Java, Go, SQL', color: 'indigo' },
  { id: 'frameworks', label: 'Frameworks & Libraries', placeholder: 'e.g. React, Next.js, FastAPI, Node.js, Django', color: 'cyan' },
  { id: 'databases', label: 'Databases & Storage', placeholder: 'e.g. PostgreSQL, Redis, MongoDB, MySQL, Cassandra', color: 'emerald' },
  { id: 'tools', label: 'Developer Tools', placeholder: 'e.g. Git, Docker, VS Code, Postman, Vite, Webpack', color: 'amber' },
  { id: 'cloud_devops', label: 'Cloud & DevOps', placeholder: 'e.g. AWS, GCP, Kubernetes, Terraform, Vercel, Render', color: 'sky' },
  { id: 'concepts', label: 'Core Computer Science & Concepts', placeholder: 'e.g. REST APIs, System Design, DSA, OOPs, DBMS, OS, Microservices', color: 'purple' },
  { id: 'soft_skills', label: 'Soft Skills & Leadership', placeholder: 'e.g. Communication, Leadership, Agile, Teamwork, Mentorship', color: 'rose' },
];

export const SKILL_ALIASES = {
  reactjs: 'React',
  'react.js': 'React',
  'react js': 'React',
  react: 'React',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  'node js': 'Node.js',
  node: 'Node.js',
  nextjs: 'Next.js',
  'next.js': 'Next.js',
  'next js': 'Next.js',
  vuejs: 'Vue.js',
  'vue.js': 'Vue.js',
  'vue js': 'Vue.js',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  js: 'JavaScript',
  javascript: 'JavaScript',
  py: 'Python',
  python: 'Python',
  golang: 'Go',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  fastapi: 'FastAPI',
  'restful apis': 'REST APIs',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  rest: 'REST APIs',
  sse: 'Server-Sent Events (SSE)',
  jwt: 'JWT',
  jwts: 'JWT',
  websocket: 'WebSockets',
  websockets: 'WebSockets',
  'system design': 'System Design',
  dsa: 'Data Structures & Algorithms (DSA)',
  'data structures & algorithms': 'Data Structures & Algorithms (DSA)',
  'data structures and algorithms': 'Data Structures & Algorithms (DSA)',
  oops: 'Object-Oriented Programming (OOPs)',
  oop: 'Object-Oriented Programming (OOPs)',
  'object oriented programming': 'Object-Oriented Programming (OOPs)',
  dbms: 'DBMS',
  os: 'Operating Systems',
  'operating systems': 'Operating Systems',
  'distributed systems': 'Distributed Systems',
  microservices: 'Microservices',
  'ci/cd': 'CI/CD',
  cicd: 'CI/CD',
  graphql: 'GraphQL',
  docker: 'Docker',
  git: 'Git',
  github: 'GitHub',
  vercel: 'Vercel',
  render: 'Render',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  terraform: 'Terraform',
};

export const COMMON_SKILL_SUGGESTIONS = {
  languages: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'SQL', 'HTML5', 'CSS3', 'Bash', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin'],
  frameworks: ['React', 'Next.js', 'FastAPI', 'Node.js', 'Express', 'Django', 'Flask', 'Tailwind CSS', 'Vue.js', 'Spring Boot', 'Redux', 'Angular', 'PyTorch', 'TensorFlow'],
  databases: ['PostgreSQL', 'Redis', 'MongoDB', 'MySQL', 'Elasticsearch', 'DynamoDB', 'Supabase', 'SQLite', 'Firebase', 'Cassandra', 'Neo4j'],
  tools: ['Git', 'Docker', 'VS Code', 'Postman', 'Vite', 'Webpack', 'Figma', 'Linux', 'npm', 'pnpm', 'Jira', 'GitHub Actions', 'Prisma', 'Pytest', 'Playwright'],
  cloud_devops: ['AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker Swarm', 'Terraform', 'Vercel', 'Render', 'Cloudflare', 'Nginx', 'Datadog', 'Prometheus', 'Grafana'],
  concepts: ['REST APIs', 'Server-Sent Events (SSE)', 'JWT', 'WebSockets', 'System Design', 'Data Structures & Algorithms (DSA)', 'Object-Oriented Programming (OOPs)', 'DBMS', 'Operating Systems', 'Distributed Systems', 'Microservices', 'CI/CD', 'GraphQL', 'MVC Architecture', 'Caching', 'Concurrency', 'Event-Driven Architecture', 'Authentication & Authorization'],
  soft_skills: ['Effective Communication', 'Technical Leadership', 'Agile & Scrum', 'Cross-functional Collaboration', 'Problem Solving', 'Code Reviews & Mentorship', 'Adaptability', 'Time Management', 'Ownership & Initiative', 'Critical Thinking'],
};

export const CONCEPT_KEYWORDS = new Set([
  'rest', 'rest api', 'rest apis', 'restful', 'restful apis', 'sse', 'server-sent events',
  'server-sent events (sse)', 'jwt', 'jwts', 'websocket', 'websockets', 'system design',
  'dsa', 'data structures', 'algorithms', 'data structures & algorithms',
  'data structures & algorithms (dsa)', 'oops', 'oop', 'object-oriented programming',
  'object-oriented programming (oops)', 'dbms', 'os', 'operating systems',
  'distributed systems', 'microservices', 'concurrency', 'multithreading', 'design patterns',
  'graphql', 'mvc', 'event-driven architecture', 'caching', 'ci/cd', 'cicd'
]);

export const cleanStr = (val) => {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === 'null' || s === 'undefined' || s === 'None') return '';
  return s;
};

export const normalizeSkillName = (rawName) => {
  const clean = cleanStr(rawName);
  if (!clean) return '';
  const lower = clean.toLowerCase();
  return SKILL_ALIASES[lower] || clean;
};

export const createEmptyProfile = (user = null) => ({
  contact_info: {
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    portfolio: '',
    leetcode: '',
    codeforces: '',
  },
  summary: '',
  education: [],
  experience: [],
  projects: [],
  skills: {
    languages: [],
    frameworks: [],
    databases: [],
    tools: [],
    cloud_devops: [],
    concepts: [],
    soft_skills: [],
  },
  certifications: [],
  achievements: [],
  links: [],
});

export const mapApiProfileToForm = (apiProfile, user = null) => {
  if (!apiProfile) return createEmptyProfile(user);

  const contact = apiProfile.contact_info || {};
  const rawSkills = apiProfile.skills || {};

  // Normalize skill arrays with alias mapping and deduplication
  const normList = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const result = [];
    arr.forEach((item) => {
      const canonical = normalizeSkillName(item);
      if (canonical && !seen.has(canonical.toLowerCase())) {
        seen.add(canonical.toLowerCase());
        result.push(canonical);
      }
    });
    return result;
  };

  let languages = normList(rawSkills.languages);
  let frameworks = normList(rawSkills.frameworks);
  let databases = normList(rawSkills.databases);
  let tools = normList(rawSkills.tools);
  let cloud_devops = normList(rawSkills.cloud_devops);
  let concepts = normList(rawSkills.concepts);
  let soft_skills = normList(rawSkills.soft_skills);

  // Auto-relocate technical concepts out of cloud_devops, tools, or soft_skills into concepts
  const moveConcepts = (sourceList) => {
    const kept = [];
    sourceList.forEach((s) => {
      if (CONCEPT_KEYWORDS.has(s.toLowerCase())) {
        if (!concepts.some((c) => c.toLowerCase() === s.toLowerCase())) {
          concepts.push(s);
        }
      } else {
        kept.push(s);
      }
    });
    return kept;
  };

  cloud_devops = moveConcepts(cloud_devops);
  soft_skills = moveConcepts(soft_skills);
  tools = moveConcepts(tools);
  frameworks = moveConcepts(frameworks);

  // Tools vs Cloud DevOps deduplication (keep in tools or cloud_devops, not both)
  const toolsSet = new Set(tools.map((t) => t.toLowerCase()));
  cloud_devops = cloud_devops.filter((cd) => !toolsSet.has(cd.toLowerCase()));

  // Ensure soft_skills contains no technical tools
  soft_skills = soft_skills.filter(
    (s) => !CONCEPT_KEYWORDS.has(s.toLowerCase()) && !toolsSet.has(s.toLowerCase())
  );

  return {
    contact_info: {
      full_name: cleanStr(contact.full_name) || user?.full_name || '',
      email: cleanStr(contact.email) || user?.email || '',
      phone: cleanStr(contact.phone),
      location: cleanStr(contact.location),
      linkedin: cleanStr(contact.linkedin),
      github: cleanStr(contact.github),
      portfolio: cleanStr(contact.portfolio),
      leetcode: cleanStr(contact.leetcode),
      codeforces: cleanStr(contact.codeforces),
    },
    summary: cleanStr(apiProfile.summary),
    skills: {
      languages,
      frameworks,
      databases,
      tools,
      cloud_devops,
      concepts,
      soft_skills,
    },
    education: (apiProfile.education || []).map((e) => ({
      institution: cleanStr(e.institution || e.school || e.college),
      degree: cleanStr(e.degree),
      field_of_study: cleanStr(e.field_of_study || e.major),
      start_year: cleanStr(e.start_year || e.start_date),
      end_year: cleanStr(e.end_year || e.end_date),
      grade_type: cleanStr(e.grade_type) || 'CGPA',
      grade_value: cleanStr(e.grade_value || e.gpa),
      secondary_percentage: cleanStr(e.secondary_percentage),
    })),
    experience: (apiProfile.experience || []).map((exp) => ({
      company: cleanStr(exp.company),
      role: cleanStr(exp.role || exp.title),
      employment_type: cleanStr(exp.employment_type) || (Boolean(exp.is_internship) ? 'Internship' : 'Full-time'),
      start_date: cleanStr(exp.start_date || exp.start_year),
      end_date: cleanStr(exp.end_date || exp.end_year),
      is_current: Boolean(exp.is_current),
      location: cleanStr(exp.location),
      technologies: Array.isArray(exp.technologies)
        ? exp.technologies.map(cleanStr).filter(Boolean)
        : [],
      bullets: Array.isArray(exp.bullets)
        ? exp.bullets.map(cleanStr).filter(Boolean)
        : (typeof exp.bullets === 'string' ? exp.bullets.split('\n').map(cleanStr).filter(Boolean) : []),
    })),
    projects: (apiProfile.projects || []).map((p) => {
      const gh = cleanStr(p.github_url || p.links?.github_repo || (p.link && p.link.includes('github.com') ? p.link : ''));
      const demo = cleanStr(p.demo_url || p.links?.live_demo || (p.link && !p.link.includes('github.com') ? p.link : ''));
      return {
        title: cleanStr(p.title || p.project_name || p.name),
        role: cleanStr(p.role),
        description: cleanStr(p.description || p.summary),
        tech_stack: Array.isArray(p.tech_stack)
          ? p.tech_stack.map(cleanStr).filter(Boolean)
          : (Array.isArray(p.technologies) ? p.technologies.map(cleanStr).filter(Boolean) : []),
        bullets: Array.isArray(p.bullets)
          ? p.bullets.map(cleanStr).filter(Boolean)
          : (Array.isArray(p.bullet_points) ? p.bullet_points.map(cleanStr).filter(Boolean) : []),
        github_url: gh,
        demo_url: demo,
        link: demo || gh || cleanStr(p.link),
        source: p.source || 'resume',
        metrics: cleanStr(p.metrics),
      };
    }),
    certifications: (apiProfile.certifications || []).map((c) => ({
      name: cleanStr(c.name || c.title),
      issuer: cleanStr(c.issuer || c.organization),
      date: cleanStr(c.date || c.issue_date || c.year),
      url: cleanStr(c.url || c.credential_url),
    })),
    achievements: (apiProfile.achievements || []).map((a) => ({
      title: cleanStr(a.title || a.name),
      description: cleanStr(a.description || a.summary),
      date: cleanStr(a.date || a.year),
      issuer: cleanStr(a.issuer || a.organization),
    })),
    links: (apiProfile.links || []).map((l) => ({
      label: cleanStr(l.label),
      url: cleanStr(l.url),
    })),
  };
};

export const formToApi = (formProfile) => {
  return {
    contact_info: {
      full_name: cleanStr(formProfile.contact_info?.full_name),
      email: cleanStr(formProfile.contact_info?.email),
      phone: cleanStr(formProfile.contact_info?.phone),
      location: cleanStr(formProfile.contact_info?.location),
      linkedin: cleanStr(formProfile.contact_info?.linkedin) || null,
      github: cleanStr(formProfile.contact_info?.github) || null,
      portfolio: cleanStr(formProfile.contact_info?.portfolio) || null,
      leetcode: cleanStr(formProfile.contact_info?.leetcode) || null,
      codeforces: cleanStr(formProfile.contact_info?.codeforces) || null,
    },
    summary: cleanStr(formProfile.summary) || null,
    skills: {
      languages: (formProfile.skills?.languages || []).map(normalizeSkillName).filter(Boolean),
      frameworks: (formProfile.skills?.frameworks || []).map(normalizeSkillName).filter(Boolean),
      databases: (formProfile.skills?.databases || []).map(normalizeSkillName).filter(Boolean),
      tools: (formProfile.skills?.tools || []).map(normalizeSkillName).filter(Boolean),
      cloud_devops: (formProfile.skills?.cloud_devops || []).map(normalizeSkillName).filter(Boolean),
      concepts: (formProfile.skills?.concepts || []).map(normalizeSkillName).filter(Boolean),
      soft_skills: (formProfile.skills?.soft_skills || []).map(normalizeSkillName).filter(Boolean),
    },
    education: (formProfile.education || []).map((e) => ({
      institution: cleanStr(e.institution),
      degree: cleanStr(e.degree),
      field_of_study: cleanStr(e.field_of_study) || null,
      start_year: cleanStr(e.start_year) || null,
      end_year: cleanStr(e.end_year) || null,
      gpa: cleanStr(e.grade_value || e.gpa) || null,
      grade_type: cleanStr(e.grade_type) || 'CGPA',
      grade_value: cleanStr(e.grade_value || e.gpa) || null,
      secondary_percentage: cleanStr(e.secondary_percentage) || null,
    })),
    experience: (formProfile.experience || []).map((exp) => ({
      company: cleanStr(exp.company),
      role: cleanStr(exp.role),
      employment_type: cleanStr(exp.employment_type) || 'Full-time',
      start_date: cleanStr(exp.start_date),
      end_date: cleanStr(exp.end_date),
      is_current: Boolean(exp.is_current),
      location: cleanStr(exp.location) || null,
      technologies: (exp.technologies || []).map(cleanStr).filter(Boolean),
      bullets: (exp.bullets || []).map(cleanStr).filter(Boolean),
    })),
    projects: (formProfile.projects || []).map((p) => {
      const gh = cleanStr(p.github_url) || null;
      const demo = cleanStr(p.demo_url) || null;
      return {
        title: cleanStr(p.title),
        role: cleanStr(p.role) || null,
        description: cleanStr(p.description) || null,
        tech_stack: (p.tech_stack || []).map(normalizeSkillName).filter(Boolean),
        bullets: (p.bullets || []).map(cleanStr).filter(Boolean),
        link: demo || gh || cleanStr(p.link) || null,
        github_url: gh,
        demo_url: demo,
        links: {
          github_repo: gh,
          live_demo: demo,
        },
        source: p.source || 'manual',
        metrics: cleanStr(p.metrics) || null,
      };
    }),
    certifications: (formProfile.certifications || []).map((c) => ({
      name: cleanStr(c.name),
      issuer: cleanStr(c.issuer),
      date: cleanStr(c.date) || null,
      url: cleanStr(c.url) || null,
    })),
    achievements: (formProfile.achievements || []).map((a) => ({
      title: cleanStr(a.title),
      description: cleanStr(a.description) || null,
      date: cleanStr(a.date) || null,
      issuer: cleanStr(a.issuer) || null,
    })),
    links: (formProfile.links || []).map((l) => ({
      label: cleanStr(l.label),
      url: cleanStr(l.url),
    })),
  };
};

export const calculateProfileCompleteness = (profile) => {
  if (!profile) return { percentage: 0, itemsNeeded: [] };

  const itemsNeeded = [];
  let score = 0;

  const ci = profile.contact_info || {};
  if (cleanStr(ci.full_name)) score += 15;
  else itemsNeeded.push('Full Name');

  if (cleanStr(ci.email)) score += 10;
  else itemsNeeded.push('Email');

  if (cleanStr(ci.phone)) score += 10;
  else itemsNeeded.push('Phone Number');

  if (cleanStr(ci.location)) score += 5;
  else itemsNeeded.push('Location');

  if (cleanStr(profile.summary) && cleanStr(profile.summary).length >= 25) {
    score += 15;
  } else {
    itemsNeeded.push('Professional Summary');
  }

  const allSkills = Object.values(profile.skills || {}).flat().filter(Boolean);
  if (allSkills.length >= 8) score += 20;
  else if (allSkills.length > 0) score += 10;
  else itemsNeeded.push('Technical Skills');

  const proj = profile.projects || [];
  if (proj.length >= 2) score += 15;
  else if (proj.length === 1) score += 8;
  else itemsNeeded.push('At least 1 Project');

  const edu = profile.education || [];
  if (edu.length >= 1) score += 5;
  else itemsNeeded.push('Education');

  const exp = profile.experience || [];
  if (exp.length >= 1) score += 5;

  return {
    percentage: Math.min(100, score),
    itemsNeeded,
  };
};
