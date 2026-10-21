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
