"""Command-line interface for :mod:`unitcalc`."""

from __future__ import annotations

import argparse
import re
import sys

from .expr import EvalError, ParseError, evaluate
from .fmt import format_number
from .units import UnitError, convert


class _ArgumentError(Exception):
    """An argparse error to render without argparse's usage block."""


class _ArgumentParser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        raise _ArgumentError(message)


def _add_format_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--sig", type=int, default=6, metavar="N")
    parser.add_argument(
        "--notation",
        choices=("auto", "fixed", "sci", "eng"),
        default="auto",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = _ArgumentParser(prog="unitcalc", description="Evaluate expressions and convert units.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    eval_parser = subparsers.add_parser("eval", help="evaluate an expression")
    eval_parser.add_argument(
        "--var",
        action="append",
        default=[],
        metavar="NAME=VALUE",
        help="set or override a variable (repeatable)",
    )
    _add_format_options(eval_parser)
    eval_parser.add_argument("expression", help="mathematical expression to evaluate")

    convert_parser = subparsers.add_parser("convert", help="convert a value between units")
    _add_format_options(convert_parser)
    convert_parser.add_argument("value", help="numeric value or expression to convert")
    convert_parser.add_argument("from_unit", help="source unit")
    convert_parser.add_argument("to_unit", help="target unit")

    return parser


def _parse_variable(assignment: str) -> tuple[str, float]:
    name, separator, value_text = assignment.partition("=")
    if not separator or re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name) is None:
        raise _ArgumentError(
            f"invalid variable assignment {assignment!r}; expected NAME=VALUE"
        )
    try:
        value = float(value_text)
    except ValueError as error:
        raise _ArgumentError(
            f"invalid numeric value in variable assignment {assignment!r}"
        ) from error
    return name, value


def _write_error(message: str) -> None:
    single_line = message.replace("\r", " ").replace("\n", " ")
    print(f"error: {single_line}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    """Run the CLI with *argv*, returning its process exit status."""
    parser = _build_parser()
    source: str | None = None
    try:
        args = parser.parse_args(argv)
        if args.command == "eval":
            source = args.expression
            variables: dict[str, float] = {}
            for assignment in args.var:
                name, value = _parse_variable(assignment)
                variables[name] = value
            result = evaluate(source, variables)
        else:
            source = args.value
            value = evaluate(source)
            result = convert(value, args.from_unit, args.to_unit)

        print(format_number(result, sig=args.sig, notation=args.notation))
        return 0
    except ParseError as error:
        _write_error(str(error))
        if source is not None:
            print(source, file=sys.stderr)
            print(" " * max(0, error.column - 1) + "^", file=sys.stderr)
        return 2
    except (_ArgumentError, EvalError, UnitError, ValueError) as error:
        _write_error(str(error))
        return 2
