"""Unit conversion with dimensional checks and affine temperature support."""

from dataclasses import dataclass
import math


class UnitError(ValueError):
    """Raised when a unit expression is unknown or malformed."""


class DimensionError(UnitError):
    """Raised when two valid units have incompatible dimensions."""


_Dimensions = tuple[int, int, int, int]
_LENGTH: _Dimensions = (1, 0, 0, 0)
_MASS: _Dimensions = (0, 1, 0, 0)
_TIME: _Dimensions = (0, 0, 1, 0)
_TEMPERATURE: _Dimensions = (0, 0, 0, 1)


@dataclass(frozen=True)
class _Unit:
    scale: float
    dimensions: _Dimensions
    affine: str | None = None


@dataclass(frozen=True)
class _Factor:
    unit: _Unit
    exponent: int
    explicit_exponent: bool


@dataclass(frozen=True)
class _ParsedUnit:
    scale: float
    dimensions: _Dimensions
    affine: str | None = None


_UNITS: dict[str, _Unit] = {
    "m": _Unit(1.0, _LENGTH),
    "km": _Unit(1000.0, _LENGTH),
    "cm": _Unit(0.01, _LENGTH),
    "mm": _Unit(0.001, _LENGTH),
    "in": _Unit(0.0254, _LENGTH),
    "ft": _Unit(0.3048, _LENGTH),
    "yd": _Unit(0.9144, _LENGTH),
    "mi": _Unit(1609.344, _LENGTH),
    "g": _Unit(0.001, _MASS),
    "kg": _Unit(1.0, _MASS),
    "lb": _Unit(0.45359237, _MASS),
    "oz": _Unit(0.45359237 / 16.0, _MASS),
    "s": _Unit(1.0, _TIME),
    "ms": _Unit(0.001, _TIME),
    "min": _Unit(60.0, _TIME),
    "h": _Unit(3600.0, _TIME),
    "N": _Unit(1.0, (1, 1, -2, 0)),
    "J": _Unit(1.0, (2, 1, -2, 0)),
    "K": _Unit(1.0, _TEMPERATURE),
    "degC": _Unit(1.0, _TEMPERATURE, "C"),
    "degF": _Unit(1.0, _TEMPERATURE, "F"),
}


class _UnitParser:
    """Parse a unit expression whose operators are evaluated left to right."""

    def __init__(self, source: str):
        self.source = source
        self.index = 0

    def parse(self) -> _ParsedUnit:
        self._skip_whitespace()
        if self.index == len(self.source):
            raise UnitError("unit expression is empty")

        factors = [self._parse_factor()]
        operators: list[str] = []
        while True:
            self._skip_whitespace()
            if self.index == len(self.source):
                break
            operator = self.source[self.index]
            if operator not in "*/":
                raise UnitError(
                    "unexpected character {!r} in unit expression at column {}".format(
                        operator, self.index + 1
                    )
                )
            operators.append(operator)
            self.index += 1
            self._skip_whitespace()
            if self.index == len(self.source):
                raise UnitError("unit expression cannot end with {!r}".format(operator))
            factors.append(self._parse_factor())

        affine_factors = [factor for factor in factors if factor.unit.affine is not None]
        if affine_factors:
            if len(factors) != 1:
                raise UnitError("affine temperature units cannot be used in compounds")
            factor = affine_factors[0]
            if factor.explicit_exponent:
                raise UnitError("affine temperature units cannot have an exponent")
            return _ParsedUnit(1.0, _TEMPERATURE, factor.unit.affine)

        first = factors[0]
        scale = self._powered_scale(first.unit.scale, first.exponent)
        dimensions = self._powered_dimensions(first.unit.dimensions, first.exponent)
        for operator, factor in zip(operators, factors[1:]):
            factor_scale = self._powered_scale(factor.unit.scale, factor.exponent)
            factor_dimensions = self._powered_dimensions(factor.unit.dimensions, factor.exponent)
            try:
                if operator == "*":
                    scale *= factor_scale
                    dimensions = tuple(a + b for a, b in zip(dimensions, factor_dimensions))
                else:
                    scale /= factor_scale
                    dimensions = tuple(a - b for a, b in zip(dimensions, factor_dimensions))
            except (OverflowError, ZeroDivisionError) as error:
                raise UnitError("unit expression has an out-of-range scale") from error
            if not math.isfinite(scale) or scale == 0.0:
                raise UnitError("unit expression has an out-of-range scale")

        return _ParsedUnit(scale, dimensions)

    def _parse_factor(self) -> _Factor:
        start = self.index
        while (
            self.index < len(self.source)
            and self.source[self.index].isascii()
            and self.source[self.index].isalpha()
        ):
            self.index += 1
        if self.index == start:
            character = self.source[self.index]
            raise UnitError(
                "expected a unit symbol at column {} (found {!r})".format(
                    self.index + 1, character
                )
            )

        symbol = self.source[start:self.index]
        unit = _UNITS.get(symbol)
        if unit is None:
            raise UnitError("unknown unit {!r}".format(symbol))

        self._skip_whitespace()
        exponent = 1
        explicit_exponent = False
        if self.index < len(self.source) and self.source[self.index] == "^":
            explicit_exponent = True
            self.index += 1
            self._skip_whitespace()
            sign = 1
            if self.index < len(self.source) and self.source[self.index] in "+-":
                if self.source[self.index] == "-":
                    sign = -1
                self.index += 1
            exponent_start = self.index
            while self.index < len(self.source) and self.source[self.index] in "0123456789":
                self.index += 1
            if self.index == exponent_start:
                raise UnitError("unit exponent must be an integer")
            try:
                exponent = sign * int(self.source[exponent_start:self.index])
            except ValueError as error:
                raise UnitError("unit exponent is out of range") from error

        return _Factor(unit, exponent, explicit_exponent)

    def _skip_whitespace(self) -> None:
        while self.index < len(self.source) and self.source[self.index].isspace():
            self.index += 1

    @staticmethod
    def _powered_scale(scale: float, exponent: int) -> float:
        try:
            powered = scale**exponent
        except (OverflowError, ZeroDivisionError) as error:
            raise UnitError("unit exponent results in an out-of-range scale") from error
        if not math.isfinite(powered) or powered == 0.0:
            raise UnitError("unit exponent results in an out-of-range scale")
        return powered

    @staticmethod
    def _powered_dimensions(dimensions: _Dimensions, exponent: int) -> _Dimensions:
        return tuple(dimension * exponent for dimension in dimensions)


def _parse_unit(expression: str) -> _ParsedUnit:
    if not isinstance(expression, str):
        raise UnitError("unit expression must be a string")
    return _UnitParser(expression).parse()


def _to_celsius(value: float, unit: _ParsedUnit) -> float:
    if unit.affine == "C":
        return value
    if unit.affine == "F":
        return (value - 32.0) * 5.0 / 9.0
    return value * unit.scale - 273.15


def _from_celsius(value: float, unit: _ParsedUnit) -> float:
    if unit.affine == "C":
        return value
    if unit.affine == "F":
        return value * 9.0 / 5.0 + 32.0
    return (value + 273.15) / unit.scale


def convert(value: float, from_unit: str, to_unit: str) -> float:
    """Convert *value* between compatible unit expressions.

    Compound expressions accept unit symbols joined by ``*`` and ``/``.
    These operators are applied from left to right, and integer exponents
    apply to the symbol immediately before ``^``.
    """

    source = _parse_unit(from_unit)
    target = _parse_unit(to_unit)
    if source.dimensions != target.dimensions:
        raise DimensionError(
            "cannot convert from {!r} to {!r}: incompatible dimensions".format(
                from_unit, to_unit
            )
        )

    numeric_value = float(value)
    if source.affine is not None or target.affine is not None:
        celsius = _to_celsius(numeric_value, source)
        return _from_celsius(celsius, target)
    return numeric_value * source.scale / target.scale
