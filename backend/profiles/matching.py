"""Similarity scoring between two approved anketas (viewer `me` vs `other`)."""

MAX_SCORE = 105  # same region 50 + age proximity up to 30 + same German city 25


def _norm(value):
    return (value or "").strip().casefold()


def match_score(me, other):
    """Heuristic similarity (0–MAX_SCORE). Higher = closer.

    Same birthplace region is the strongest signal (shared roots matter in this
    community), then age proximity, then living in the same German city."""
    score = 0
    if me.birthplace_region and me.birthplace_region == other.birthplace_region:
        score += 50
    score += max(0, 30 - abs((me.age or 0) - (other.age or 0)) * 3)
    if _norm(me.current_residence_germany) and \
            _norm(me.current_residence_germany) == _norm(other.current_residence_germany):
        score += 25
    return score


def match_percent(me, other):
    """Score as a percentage, rounded to the nearest 10 (0, 10, …, 100)."""
    pct = match_score(me, other) / MAX_SCORE * 100
    return max(0, min(100, int(round(pct / 10) * 10)))


def match_reasons(me, other):
    """Short Uzbek phrases describing why they match (for the detail page)."""
    reasons = []
    if me.birthplace_region and me.birthplace_region == other.birthplace_region:
        reasons.append("bir xil viloyatdan")
    if abs((me.age or 0) - (other.age or 0)) <= 5:
        reasons.append("yoshi sizga yaqin")
    if _norm(me.current_residence_germany) and \
            _norm(me.current_residence_germany) == _norm(other.current_residence_germany):
        reasons.append("bir xil shaharda yashaysiz")
    return reasons
