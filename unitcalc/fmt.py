"""Significant-figure formatting for calculator results."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN, localcontext


_NOTATIONS = {"auto", "fixed", "sci", "eng"}


def _trim_fractional_zeros(value: Decimal) -> str:
    """Render a Decimal without insignificant fractional zeroes."""
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in {"", "-0"} else text


def _exponential(value: Decimal, exponent: int, *, engineering: bool) -> str:
    mantissa = value.scaleb(-exponent)
    rendered = _trim_fractional_zeros(mantissa)
    if engineering:
        exponent_text = str(exponent)
    else:
        exponent_text = f"{exponent:+d}"
    return f"{rendered}e{exponent_text}"


def format_number(x: float, sig: int = 6, notation: str = "auto") -> str:
    """Format *x* to ``sig`` significant figures in the requested notation.

    Decimal arithmetic based on the float's shortest string representation
    keeps rounding deterministic and avoids changing the process-wide decimal
    context.
    """
    if not isinstance(sig, int) or isinstance(sig, bool) or sig < 1:
        raise ValueError("sig must be an integer greater than or equal to 1")
    if notation not in _NOTATIONS:
        raise ValueError(f"unsupported notation: {notation!r}")

    try:
        number = Decimal(str(x))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"cannot format {x!r} as a number") from exc

    if number.is_nan():
        return "nan"
    if number.is_infinite():
        return "-inf" if number.is_signed() else "inf"
    if number.is_zero():
        return "0"

    original_order = number.copy_abs().adjusted()
    selected = notation
    if selected == "auto":
        selected = "fixed" if -4 <= original_order < 9 else "sci"

    with localcontext() as context:
        context.prec = max(28, sig + abs(original_order) + 10)
        quantum = Decimal(1).scaleb(original_order - sig + 1)
        rounded = number.quantize(quantum, rounding=ROUND_HALF_EVEN)

        if rounded.is_zero():
            return "0"
        if selected == "fixed":
            return _trim_fractional_zeros(rounded)

        rounded_order = rounded.copy_abs().adjusted()
        if selected == "sci":
            return _exponential(rounded, rounded_order, engineering=False)

        engineering_order = (rounded_order // 3) * 3
        return _exponential(rounded, engineering_order, engineering=True)
