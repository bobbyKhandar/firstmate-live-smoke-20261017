import math
import unittest

from unitcalc.expr import EvalError, ParseError, evaluate


class EvaluateNumbersTest(unittest.TestCase):
    def test_parses_integer_decimal_scientific_and_whitespace(self):
        cases = {
            "42": 42.0,
            ".5": 0.5,
            "2.": 2.0,
            "1e3": 1000.0,
            "2.5E-2": 0.025,
            "  2.5 \n * 4 ": 10.0,
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(evaluate(source), expected)

    def test_parentheses_and_binary_operators(self):
        cases = {
            "(2 + 3) * 4": 20.0,
            "2 * (3 + 4)^2": 98.0,
            "7 / 2": 3.5,
            "7 % 4": 3.0,
            "-7 % 4": 1.0,
            "8 - 3 - 2": 3.0,
            "8 / 4 / 2": 1.0,
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertEqual(evaluate(source), expected)

    def test_power_is_right_associative_and_binds_tighter_than_unary_sign(self):
        self.assertEqual(evaluate("2^3^2"), 512.0)
        self.assertEqual(evaluate("-2^2"), -4.0)
        self.assertEqual(evaluate("(-2)^2"), 4.0)
        self.assertEqual(evaluate("2^-1"), 0.5)
        self.assertEqual(evaluate("+2^2"), 4.0)

    def test_constants_and_variables(self):
        self.assertAlmostEqual(evaluate("pi"), math.pi)
        self.assertAlmostEqual(evaluate("e"), math.e)
        self.assertEqual(evaluate("a * 2", {"a": 3.5}), 7.0)

    def test_variables_shadow_constants_without_mutating_mapping(self):
        variables = {"pi": 3.0, "e": 2.0, "x": 4.0}
        original = dict(variables)
        self.assertEqual(evaluate("pi + e + x", variables), 9.0)
        self.assertEqual(variables, original)


class EvaluateFunctionsTest(unittest.TestCase):
    def test_unary_math_functions(self):
        cases = {
            "sqrt(9)": 3.0,
            "abs(-4)": 4.0,
            "sin(0)": 0.0,
            "cos(0)": 1.0,
            "tan(0)": 0.0,
            "ln(e)": 1.0,
            "log10(1000)": 3.0,
            "exp(1)": math.e,
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                self.assertAlmostEqual(evaluate(source), expected)

    def test_min_max_and_round_argument_forms(self):
        self.assertEqual(evaluate("min(4)"), 4.0)
        self.assertEqual(evaluate("min(4, -2, 8)"), -2.0)
        self.assertEqual(evaluate("max(4)"), 4.0)
        self.assertEqual(evaluate("max(4, -2, 8)"), 8.0)
        self.assertEqual(evaluate("round(2.5)"), 2.0)
        self.assertEqual(evaluate("round(2.675, 2)"), 2.67)
        self.assertIsInstance(evaluate("min(4, 8)"), float)

    def test_function_arity_errors_are_eval_errors(self):
        cases = (
            "sqrt()", "sqrt(1, 2)", "abs()", "sin(1, 2)", "cos()",
            "tan(1, 2)", "ln()", "log10(1, 2)", "exp()", "min()",
            "max()", "round()", "round(1, 2, 3)",
        )
        for source in cases:
            with self.subTest(source=source):
                with self.assertRaises(EvalError):
                    evaluate(source)

    def test_unknown_names_and_unknown_call_names_are_eval_errors(self):
        for source in ("missing", "PI", "mystery(2)"):
            with self.subTest(source=source):
                with self.assertRaises(EvalError):
                    evaluate(source)

    def test_arithmetic_and_math_domain_errors_are_eval_errors(self):
        cases = (
            "1 / 0", "1 % 0", "sqrt(-1)", "ln(-1)", "ln(0)",
            "log10(-1)", "(-1)^0.5", "exp(10000)", "2^10000",
        )
        for source in cases:
            with self.subTest(source=source):
                with self.assertRaises(EvalError):
                    evaluate(source)

    def test_round_ndigits_must_be_integer_valued(self):
        with self.assertRaises(EvalError):
            evaluate("round(1.25, 1.5)")


class ParseErrorsTest(unittest.TestCase):
    def assertParseColumn(self, source, column):
        with self.assertRaises(ParseError) as caught:
            evaluate(source)
        self.assertEqual(caught.exception.column, column)

    def test_empty_and_whitespace_input_point_to_end(self):
        self.assertParseColumn("", 1)
        self.assertParseColumn("   ", 4)

    def test_unexpected_character_reports_its_column(self):
        self.assertParseColumn("1 @ 2", 3)
        self.assertParseColumn("1 $", 3)

    def test_malformed_numeric_syntax_reports_offending_column(self):
        self.assertParseColumn(".", 1)
        self.assertParseColumn("1..2", 3)
        self.assertParseColumn("1e+", 2)

    def test_implicit_multiplication_is_rejected(self):
        self.assertParseColumn("2(3)", 2)

    def test_unbalanced_extra_and_missing_parentheses(self):
        self.assertParseColumn("(1+2", 5)
        self.assertParseColumn("sqrt(2", 7)
        self.assertParseColumn("1+2)", 4)
        self.assertParseColumn(")", 1)

    def test_trailing_operators_and_operator_in_wrong_position(self):
        self.assertParseColumn("1 + * 2", 5)
        self.assertParseColumn("1 +", 4)
        self.assertParseColumn("1 ^", 4)

    def test_missing_function_arguments_commas_and_trailing_junk(self):
        self.assertParseColumn("min(,1)", 5)
        self.assertParseColumn("min(1,)", 7)
        self.assertParseColumn("min(1 2)", 7)
        self.assertParseColumn("1 2", 3)
        self.assertParseColumn("sqrt(1) 2", 9)


if __name__ == "__main__":
    unittest.main()
