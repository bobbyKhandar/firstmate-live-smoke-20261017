"""Public API for the unitcalc package."""

from .units import DimensionError, UnitError, convert

__version__ = "0.1.0"

__all__ = ["DimensionError", "UnitError", "convert"]
