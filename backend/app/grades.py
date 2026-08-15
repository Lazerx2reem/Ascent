"""Grade ordering helpers for the V scale (bouldering) and YDS (routes)."""

# Outcomes that count as having climbed the thing cleanly, as opposed to still
# working it. Shared by the stats, coach, and training layers.
SEND_TYPES: tuple[str, ...] = ("flash", "onsight", "redpoint", "repeat")

V_SCALE: list[str] = ["VB"] + [f"V{i}" for i in range(18)]

YDS: list[str] = ["5.5", "5.6", "5.7", "5.8", "5.9"] + [
    f"5.{number}{letter}" for number in range(10, 16) for letter in "abcd"
]

_V_INDEX = {g: i for i, g in enumerate(V_SCALE)}
_YDS_INDEX = {g: i for i, g in enumerate(YDS)}


def grade_sort_key(grade: str) -> int:
    """Sortable difficulty index within a grade system. Unknown grades sort first."""
    if grade in _V_INDEX:
        return _V_INDEX[grade]
    if grade in _YDS_INDEX:
        return _YDS_INDEX[grade]
    return -1
