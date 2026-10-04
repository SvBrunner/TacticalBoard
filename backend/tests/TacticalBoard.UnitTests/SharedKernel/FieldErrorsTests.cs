using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.UnitTests.SharedKernel;

public class FieldErrorsTests
{
    [Fact]
    public void A_field_error_has_a_code_an_english_message_and_values()
    {
        var error = FieldError.TooLong(100);

        Assert.Equal("too-long", error.Code);
        Assert.Equal("must be at most 100 characters long", error.Message);
        Assert.Equal(100, error.Values["maxLength"]);
        Assert.Equal("must be at most 100 characters long", error.ToString());
    }

    [Fact]
    public void The_common_errors_have_stable_codes_and_overridable_messages()
    {
        Assert.Equal(("required", "must not be empty"), (FieldError.Required().Code, FieldError.Required().Message));
        Assert.Equal("Name missing.", FieldError.Required("Name missing.").Message);
        Assert.Equal("Too long.", FieldError.TooLong(5, "Too long.").Message);
        Assert.Equal("control-characters", FieldError.ControlCharacters().Code);
        Assert.Empty(FieldError.Required().Values);
    }

    [Theory]
    [InlineData("Not-Kebab")]
    [InlineData("")]
    [InlineData("a b")]
    public void Refuses_a_code_that_is_not_kebab_case(string code) =>
        Assert.Throws<ArgumentException>(() => FieldError.Of(code, "message"));

    [Fact]
    public void Refuses_a_blank_message() =>
        Assert.Throws<ArgumentException>(() => FieldError.Of("code", " "));

    [Fact]
    public void The_code_object_is_the_code_with_its_values()
    {
        var error = FieldError.Of("duplicate-id", "duplicate frame id \"f1\"", ("id", "f1"));

        Assert.Equal(new Dictionary<string, object> { ["code"] = "duplicate-id", ["id"] = "f1" }, error.ToCodeObject());
    }

    [Fact]
    public void Collects_errors_per_field_in_order_as_messages_and_as_codes()
    {
        var errors = new FieldErrors()
            .Add("name", FieldError.Required())
            .Add("document.x", FieldError.Of("expected-finite-number", "expected finite number"))
            .Add("name", FieldError.TooLong(3));

        Assert.True(errors.Any);
        Assert.Equal(2, errors.For("name").Count);
        Assert.Empty(errors.For("other"));
        Assert.Equal(["must not be empty", "must be at most 3 characters long"], errors.Messages()["name"]);
        Assert.Equal(["expected finite number"], errors.Messages()["document.x"]);
        var codes = errors.Codes();
        Assert.Equal(["required", "too-long"], codes["name"].Select(code => code["code"]));
        Assert.Equal(3, codes["name"][1]["maxLength"]);
        Assert.Equal(codes.Keys.Order(), errors.Messages().Keys.Order());
        Assert.Same(errors.Codes().GetType(), ((IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>)errors.Extensions()[FieldErrors.ExtensionName]!).GetType());
        Assert.Equal("fieldErrors", FieldErrors.ExtensionName);
    }

    [Fact]
    public void Starts_empty_and_checks_its_arguments()
    {
        var errors = new FieldErrors();

        Assert.False(errors.Any);
        Assert.Empty(errors.Messages());
        Assert.Throws<ArgumentException>(() => errors.Add(" ", FieldError.Required()));
        Assert.Throws<ArgumentNullException>(() => errors.Add("name", null!));
    }
}
