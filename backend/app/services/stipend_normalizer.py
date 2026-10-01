import logging
from typing import Optional, Tuple, Dict
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Base exchange rates to INR and USD (cached static rates, easily refreshed)
RATES_TO_INR: Dict[str, float] = {
    "INR": 1.0,
    "USD": 86.5,
    "EUR": 93.0,
    "GBP": 111.0,
    "CAD": 62.0,
    "SGD": 65.0,
    "AUD": 55.0,
    "JPY": 0.56,
}


class NormalizedStipend(BaseModel):
    original_min: Optional[float] = None
    original_max: Optional[float] = None
    original_currency: str = "INR"
    original_period: str = "monthly"  # "monthly", "hourly", "annual", "lump_sum"
    normalized_monthly_home: Optional[float] = None  # in user's home currency
    home_currency: str = "INR"
    display_text: str = ""
    original_display: str = ""


class StipendNormalizerService:
    """
    Normalizes stipends across currencies (INR, USD, EUR, GBP, CAD, SGD)
    and periods (hourly, monthly, annual) into a unified monthly amount
    in the candidate's home currency.
    """

    @classmethod
    def convert_currency(cls, amount: float, from_curr: str, to_curr: str) -> float:
        if not amount or from_curr.upper() == to_curr.upper():
            return amount

        from_c = from_curr.upper()
        to_c = to_curr.upper()

        # Convert to INR first, then to target
        rate_from = RATES_TO_INR.get(from_c, 86.5)
        rate_to = RATES_TO_INR.get(to_c, 86.5)

        amount_inr = amount * rate_from
        return amount_inr / rate_to

    @classmethod
    def normalize_to_monthly(cls, amount: float, period: str) -> float:
        p = (period or "monthly").lower().strip()
        if "hour" in p:
            # Assume 160 hours per month (40 hrs/wk * 4 wks)
            return amount * 160.0
        elif "year" in p or "annual" in p or "lpa" in p:
            return amount / 12.0
        elif "week" in p:
            return amount * 4.33
        elif "day" in p:
            return amount * 22.0
        # Default monthly
        return amount

    @classmethod
    def normalize_stipend(
        cls,
        stipend_min: Optional[float],
        stipend_max: Optional[float],
        currency: Optional[str] = "INR",
        period: Optional[str] = "monthly",
        home_currency: Optional[str] = "INR"
    ) -> NormalizedStipend:
        curr = (currency or "INR").strip().upper()
        h_curr = (home_currency or "INR").strip().upper()
        prd = (period or "monthly").strip().lower()

        if stipend_min is None and stipend_max is None:
            return NormalizedStipend(
                original_currency=curr,
                original_period=prd,
                home_currency=h_curr,
                display_text="Unpaid / Competitive",
                original_display="Unpaid / Not Disclosed"
            )

        eff_min = stipend_min if stipend_min is not None else stipend_max
        eff_max = stipend_max if stipend_max is not None else stipend_min

        # Convert to monthly
        monthly_min = cls.normalize_to_monthly(eff_min, prd)
        monthly_max = cls.normalize_to_monthly(eff_max, prd)

        # Convert to candidate's home currency
        conv_min = cls.convert_currency(monthly_min, curr, h_curr)
        conv_max = cls.convert_currency(monthly_max, curr, h_curr)

        avg_monthly_home = (conv_min + conv_max) / 2.0

        # Symbols
        sym_map = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£", "CAD": "C$", "SGD": "S$"}
        h_sym = sym_map.get(h_curr, h_curr)
        orig_sym = sym_map.get(curr, curr)

        # Build original display
        if eff_min == eff_max:
            orig_disp = f"{orig_sym}{eff_min:,.0f} / {prd}"
            home_disp = f"{h_sym}{avg_monthly_home:,.0f} / month"
        else:
            orig_disp = f"{orig_sym}{eff_min:,.0f} - {orig_sym}{eff_max:,.0f} / {prd}"
            home_disp = f"{h_sym}{conv_min:,.0f} - {h_sym}{conv_max:,.0f} / month"

        return NormalizedStipend(
            original_min=eff_min,
            original_max=eff_max,
            original_currency=curr,
            original_period=prd,
            normalized_monthly_home=round(avg_monthly_home, 2),
            home_currency=h_curr,
            display_text=home_disp,
            original_display=orig_disp
        )


stipend_normalizer = StipendNormalizerService()
