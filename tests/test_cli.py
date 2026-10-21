import subprocess
import sys
import unittest
from pathlib import Path

from unitcalc import __all__, __version__, main


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def run_cli(*arguments):
    return subprocess.run(
        [sys.executable, "-m", "unitcalc", *arguments],
        cwd=REPOSITORY_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )


class CommandLineTests(unittest.TestCase):
    def assert_cli(self, arguments, *, stdout="", stderr="", status=0):
        result = run_cli(*arguments)
        self.assertEqual(result.returncode, status, result)
        self.assertEqual(result.stdout, stdout)
        self.assertEqual(result.stderr, stderr)
        return result

    def assert_cli_error(self, arguments):
        result = run_cli(*arguments)
        self.assertEqual(result.returncode, 2, result)
        self.assertEqual(result.stdout, "")
        self.assertTrue(result.stderr.startswith("error: "), result.stderr)
        self.assertNotIn("Traceback", result.stderr)
        return result.stderr

    def test_package_exports_version_and_main(self):
        self.assertEqual(__version__, "0.1.0")
        self.assertIn("main", __all__)
        self.assertEqual(__all__, sorted(__all__))
        self.assertTrue(callable(main))

    def test_eval_example_and_default_formatting(self):
        self.assert_cli(["eval", "2*(3+4)^2"], stdout="98\n")

    def test_repeated_variables_use_last_assignment_and_shadow_constants(self):
        self.assert_cli(
            ["eval", "x+y", "--var", "x=2", "--var", "x=3", "--var", "y=4"],
            stdout="7\n",
        )
        self.assert_cli(
            ["eval", "pi+e", "--var", "pi=3", "--var", "e=2"],
            stdout="5\n",
        )

    def test_eval_significant_figures_and_each_notation(self):
        self.assert_cli(
            ["eval", "12345", "--sig", "3", "--notation", "auto"],
            stdout="12300\n",
        )
        self.assert_cli(
            ["eval", "12345", "--sig", "3", "--notation", "fixed"],
            stdout="12300\n",
        )
        self.assert_cli(
            ["eval", "12345", "--sig", "3", "--notation", "sci"],
            stdout="1.23e+4\n",
        )
        self.assert_cli(
            ["eval", "12345", "--sig", "3", "--notation", "eng"],
            stdout="12.3e3\n",
        )

    def test_convert_examples_temperature_and_formatting_options(self):
        self.assert_cli(["convert", "100", "km/h", "m/s"], stdout="27.7778\n")
        self.assert_cli(["convert", "60*1.5", "min", "h"], stdout="1.5\n")
        self.assert_cli(["convert", "100", "degC", "degF"], stdout="212\n")
        self.assert_cli(
            ["convert", "1", "km", "m", "--sig", "3", "--notation", "sci"],
            stdout="1e+3\n",
        )

    def test_parse_errors_print_source_and_caret_for_eval_and_convert(self):
        self.assertEqual(
            self.assert_cli_error(["eval", "1 + * 2"]),
            "error: expected an expression, found '*' at column 5\n"
            "1 + * 2\n"
            "    ^\n",
        )
        self.assertEqual(
            self.assert_cli_error(["convert", "(1+2", "m", "cm"]),
            "error: expected ')' to close '(' at column 5\n"
            "(1+2\n"
            "    ^\n",
        )

    def test_evaluation_and_conversion_errors_are_one_line(self):
        for arguments in (
            ["eval", "missing"],
            ["eval", "1/0"],
            ["eval", "sqrt(-1)"],
            ["convert", "1", "m", "s"],
            ["convert", "1", "furlong", "m"],
        ):
            with self.subTest(arguments=arguments):
                stderr = self.assert_cli_error(arguments)
                self.assertEqual(stderr.count("\n"), 1)

    def test_bad_variables_and_invalid_format_arguments_return_status_two(self):
        for arguments in (
            ["eval", "x", "--var", "bad-name=2"],
            ["eval", "x", "--var", "x=not-a-number"],
            ["eval", "1", "--sig", "nope"],
            ["eval", "1", "--sig", "0"],
            ["eval", "1", "--notation", "engineering"],
        ):
            with self.subTest(arguments=arguments):
                self.assert_cli_error(arguments)

    def test_missing_arguments_and_negative_expressions(self):
        self.assert_cli_error(["eval"])
        self.assert_cli_error(["convert", "1", "m"])
        self.assert_cli(["eval", "--", "-2^2"], stdout="-4\n")
        self.assert_cli(["convert", "--", "-2", "m", "cm"], stdout="-200\n")

    def test_help_is_successful_argparse_help(self):
        result = run_cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertTrue(result.stdout.startswith("usage: unitcalc "))
        self.assertIn("eval", result.stdout)
        self.assertIn("convert", result.stdout)
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
