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
