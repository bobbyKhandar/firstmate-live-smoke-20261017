"""A small, safe expression parser and evaluator."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Callable, Mapping, Union


class ParseError(ValueError):
    """Raised for invalid expression syntax.

    ``column`` is a 1-based character offset into the original source. The
    end-of-input position is one character beyond the final source character.
    """

    def __init__(self, message: str, column: int) -> None:
        self.column = column
        super().__init__(f"{message} at column {column}")


class EvalError(ValueError):
    """Raised when a syntactically valid expression cannot be evaluated."""


@dataclass(frozen=True)
class _Token:
    kind: str
    value: str
    start: int


_NUMBER = re.compile(r"(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_OPERATORS = "+-*/%^(),"


def _tokenize(source: str) -> list[_Token]:
    tokens: list[_Token] = []
    index = 0
    while index < len(source):
        char = source[index]
        if char.isspace():
            index += 1
            continue

        number = _NUMBER.match(source, index)
        if number is not None:
            tokens.append(_Token("number", number.group(), index))
            index = number.end()
            continue

        identifier = _IDENTIFIER.match(source, index)
        if identifier is not None:
            tokens.append(_Token("identifier", identifier.group(), index))
            index = identifier.end()
            continue

        if char in _OPERATORS:
            tokens.append(_Token(char, char, index))
        else:
            # Keeping an invalid token lets the parser report an earlier
            # syntax error before a later unexpected character.
            tokens.append(_Token("invalid", char, index))
        index += 1

    tokens.append(_Token("eof", "", len(source)))
    return tokens


@dataclass(frozen=True)
class _Number:
    value: float


@dataclass(frozen=True)
class _Name:
    value: str


@dataclass(frozen=True)
class _Unary:
    operator: str
    operand: "_Node"


@dataclass(frozen=True)
class _Binary:
    operator: str
    left: "_Node"
    right: "_Node"


@dataclass(frozen=True)
class _Call:
    name: str
    arguments: tuple["_Node", ...]


_Node = Union[_Number, _Name, _Unary, _Binary, _Call]


class _Parser:
    def __init__(self, source: str) -> None:
        self._tokens = _tokenize(source)
        self._position = 0

    @property
    def _current(self) -> _Token:
        return self._tokens[self._position]

    def _advance(self) -> _Token:
        token = self._current
        if token.kind != "eof":
            self._position += 1
        return token

    def _error(self, message: str, token: _Token | None = None) -> ParseError:
        found = self._current if token is None else token
        return ParseError(message, found.start + 1)

    def parse(self) -> _Node:
        if self._current.kind == "eof":
            raise self._error("empty expression")
        result = self._parse_sum()
        if self._current.kind != "eof":
            raise self._error(f"unexpected token {self._current.value!r}")
        return result

    def _parse_sum(self) -> _Node:
        node = self._parse_product()
        while self._current.kind in ("+", "-"):
            operator = self._advance().kind
            node = _Binary(operator, node, self._parse_product())
        return node

    def _parse_product(self) -> _Node:
        node = self._parse_unary()
        while self._current.kind in ("*", "/", "%"):
            operator = self._advance().kind
            node = _Binary(operator, node, self._parse_unary())
        return node

    def _parse_unary(self) -> _Node:
        if self._current.kind in ("+", "-"):
            operator = self._advance().kind
            return _Unary(operator, self._parse_unary())
        return self._parse_power()

    def _parse_power(self) -> _Node:
        node = self._parse_primary()
        if self._current.kind == "^":
            self._advance()
            node = _Binary("^", node, self._parse_unary())
        return node

    def _parse_primary(self) -> _Node:
        token = self._current
        if token.kind == "number":
            self._advance()
            return _Number(float(token.value))

        if token.kind == "identifier":
            self._advance()
            if self._current.kind != "(":
                return _Name(token.value)
            self._advance()
            arguments: list[_Node] = []
            if self._current.kind != ")":
                arguments.append(self._parse_sum())
                while self._current.kind == ",":
                    self._advance()
                    arguments.append(self._parse_sum())
            if self._current.kind != ")":
                raise self._error("expected ',' or ')' after function arguments")
            self._advance()
            return _Call(token.value, tuple(arguments))

        if token.kind == "(":
            self._advance()
            node = self._parse_sum()
            if self._current.kind != ")":
                raise self._error("expected ')' to close '('")
            self._advance()
            return node

        if token.kind == "eof":
            raise self._error("expected an expression")
        if token.kind == "invalid":
            raise self._error(f"unexpected character {token.value!r}")
        raise self._error(f"expected an expression, found {token.value!r}")


def _function(name: str, arguments: tuple[float, ...]) -> float:
    unary_functions: dict[str, Callable[[float], float]] = {
        "sqrt": math.sqrt,
        "abs": abs,
        "sin": math.sin,
        "cos": math.cos,
        "tan": math.tan,
        "ln": math.log,
        "log10": math.log10,
        "exp": math.exp,
    }
    if name in unary_functions:
        if len(arguments) != 1:
            raise EvalError(f"{name} expects exactly one argument")
        return float(unary_functions[name](arguments[0]))
    if name in ("min", "max"):
        if not arguments:
            raise EvalError(f"{name} expects at least one argument")
        return float((min if name == "min" else max)(arguments))
    if name == "round":
        if len(arguments) not in (1, 2):
            raise EvalError("round expects one or two arguments")
        if len(arguments) == 1:
            return float(round(arguments[0]))
        ndigits = arguments[1]
        if not math.isfinite(ndigits) or not ndigits.is_integer():
            raise EvalError("round ndigits must be an integer")
        return float(round(arguments[0], int(ndigits)))
    raise EvalError(f"unknown function {name!r}")


def _evaluate(node: _Node, variables: Mapping[str, float]) -> float:
    if isinstance(node, _Number):
        return node.value
    if isinstance(node, _Name):
        if node.value in variables:
            return float(variables[node.value])
        if node.value == "pi":
            return math.pi
        if node.value == "e":
            return math.e
        raise EvalError(f"unknown name {node.value!r}")
    if isinstance(node, _Unary):
        operand = _evaluate(node.operand, variables)
        return operand if node.operator == "+" else -operand
    if isinstance(node, _Binary):
        left = _evaluate(node.left, variables)
        right = _evaluate(node.right, variables)
        if node.operator in ("/", "%") and right == 0.0:
            raise EvalError("division or modulo by zero")
        if node.operator == "+":
            return left + right
        if node.operator == "-":
            return left - right
        if node.operator == "*":
            return left * right
        if node.operator == "/":
            return left / right
        if node.operator == "%":
            return left % right
        return math.pow(left, right)
    if isinstance(node, _Call):
        arguments = tuple(_evaluate(argument, variables) for argument in node.arguments)
        return _function(node.name, arguments)
    raise EvalError("invalid expression")


def evaluate(source: str, variables: dict[str, float] | None = None) -> float:
    """Parse and evaluate a real-valued mathematical expression."""

    tree = _Parser(source).parse()
    try:
        return float(_evaluate(tree, {} if variables is None else variables))
    except EvalError:
        raise
    except (ArithmeticError, TypeError, ValueError) as error:
        raise EvalError(str(error)) from error
