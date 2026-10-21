"""Dependency-free expression and unit utilities."""

from .expr import EvalError, ParseError, evaluate

__version__ = "0.1.0"

__all__ = ["EvalError", "ParseError", "evaluate"]
