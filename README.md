# Firstmate Swarm Smoke Test
Results: alpha=todo; beta=todo; gamma=todo

## unitcalc

`unitcalc` is a dependency-free Python 3.10+ package for evaluating mathematical expressions and converting units.

### Expressions

Use `unitcalc.expr.evaluate(source, variables=None)` to evaluate a real-valued expression. The package exports `evaluate`, `ParseError`, and `EvalError` from `unitcalc`:

```python
from unitcalc import evaluate

evaluate("2*(3+4)^2")  # 98.0
evaluate("x^2 + pi", {"x": 3})
```

Expressions support integer, decimal, and scientific notation; parentheses; unary signs; `+`, `-`, `*`, `/`, `%`, and right-associative `^`; and the constants `pi` and `e`. Implicit multiplication is not supported. Variables can shadow constants.

Available functions are `sqrt`, `abs`, `sin`, `cos`, `tan`, `ln`, `log10`, `exp`, `min`, `max`, and `round`. `min` and `max` accept one or more arguments, while `round` accepts one or two. Syntax errors raise `ParseError` with a 1-based `column`; invalid names, arity, and mathematical operations raise `EvalError`.

### Units and conversion

`unitcalc.convert(value, from_unit, to_unit)` converts values between compatible units and raises `UnitError` for unknown or malformed units and `DimensionError` for incompatible dimensions. Supported base units include `m`, `kg`, `s`, and `K`; the package also supports `km`, `cm`, `mm`, `in`, `ft`, `yd`, `mi`, `g`, `lb`, `oz`, `ms`, `min`, `h`, `N`, `J`, `degC`, and `degF`.

Compound units use `*`, `/`, and integer powers. Operators are evaluated from left to right, so `m/s*s` has the dimension of length. For example, `convert(100, "km/h", "m/s")` returns approximately `27.7778`, and `convert(100, "degC", "degF")` returns `212`. Celsius and Fahrenheit are affine temperature units and can be used only on their own; Kelvin can be used in compounds.

### Number formatting

`unitcalc.fmt.format_number(x, sig=6, notation="auto")` rounds to significant figures and strips insignificant fractional zeroes. The `auto` notation uses fixed form for magnitudes from `1e-4` up to (but not including) `1e9`, and scientific form outside that range. Choose `fixed`, `sci`, or `eng` explicitly when needed; engineering exponents are multiples of three.

```python
from unitcalc import format_number

format_number(999.96, sig=4)                 # "1000"
format_number(12345, sig=3, notation="eng")  # "12.3e3"
```

### Command line

Run the calculator with `python -m unitcalc`. The `eval` subcommand accepts an
expression, repeatable `--var NAME=VALUE` assignments, and `--sig` and
`--notation {auto,fixed,sci,eng}` formatting options:

```console
$ python -m unitcalc eval "2*(3+4)^2"
98
$ python -m unitcalc eval "x^2" --var x=3 --sig 3
9
```

The `convert` subcommand evaluates its value as an expression before converting
between units. Both subcommands print formatted results; errors go to standard
error with status 2, and expression syntax errors include the source and a
caret at the error column. Use `--` before a negative expression so argparse
passes it as a value:

```console
$ python -m unitcalc convert 100 km/h m/s
27.7778
$ python -m unitcalc convert "60*1.5" min h
1.5
```

The package also exports `main(argv=None)` for embedding the same CLI.
