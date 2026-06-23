"""Similarity scoring — used only as an admin assist when assigning matches."""

MAX_SCORE = 105  # same region 50 + age proximity up to 30 + same German city 25


def _norm(value):
    return (value or "").strip().casefold()


def match_score(a, b):
    """Heuristic similarity (0–MAX_SCORE). Higher = closer.

    Same birthplace region is the strongest signal, then age proximity, then
    living in the same German city."""
    score = 0
    if a.birthplace_region and a.birthplace_region == b.birthplace_region:
        score += 50
    score += max(0, 30 - abs((a.age or 0) - (b.age or 0)) * 3)
    if _norm(a.current_residence_germany) and \
            _norm(a.current_residence_germany) == _norm(b.current_residence_germany):
        score += 25
    return score


def match_percent(a, b):
    """Score as a percentage, rounded to the nearest 10 (0, 10, …, 100)."""
    pct = match_score(a, b) / MAX_SCORE * 100
    return max(0, min(100, int(round(pct / 10) * 10)))
