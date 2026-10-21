"""Dependency-free expression and unit utilities."""

from .expr import EvalError, ParseError, evaluate
from .fmt import format_number
from .units import DimensionError, UnitError, convert

__version__ = "0.1.0"

__all__ = ["DimensionError", "EvalError", "ParseError", "UnitError", "convert", "evaluate", "format_number"]
