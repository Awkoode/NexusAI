using Test

include(joinpath(@__DIR__, "..", "src", "StatisticsEngine.jl"))
using .StatisticsEngine
using .StatisticsEngine: validate_columns, validate_matrix, validate_missing_policy,
    describe_columns, describe_column, correlation_matrix, covariance_matrix,
    analyze_matrix, ValidationError, finite_or_nothing

include(joinpath(@__DIR__, "..", "src", "server.jl"))

using JSON3
using HTTP

req_post(path, body; key="dev-julia-service-key") = HTTP.Request(
    "POST", path,
    ["Content-Type" => "application/json", "X-Julia-Service-Key" => key],
    Vector{UInt8}(JSON3.write(body)),
)

@testset "StatisticsEngine" begin

    @testset "describe: basic stats" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict("x" => [1.0, 2.0, 3.0, 4.0])))
        out = describe_columns(vc)
        col = out["columns"][1]
        @test col["count"] == 4
        @test col["missing"] == 0
        @test col["mean"] ≈ 2.5
        @test col["median"] ≈ 2.5
        @test col["min"] == 1.0
        @test col["max"] == 4.0
        # sample std (n-1): sqrt(5/3)
        @test col["std"] ≈ sqrt(5 / 3)
        @test col["variance"] ≈ 5 / 3
        @test col["distinct"] == 4
    end

    @testset "describe: missing values excluded" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict("x" => [1.0, nothing, 3.0])))
        col = describe_columns(vc)["columns"][1]
        @test col["count"] == 2
        @test col["missing"] == 1
        @test col["mean"] ≈ 2.0
    end

    @testset "describe: empty and constant columns" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict("e" => [nothing, nothing])))
        col = describe_columns(vc)["columns"][1]
        @test col["count"] == 0
        @test col["mean"] === nothing
        @test !isempty(col["warnings"])

        vc2 = validate_columns(Dict{String,Any}("columns" => Dict("c" => [5.0, 5.0, 5.0])))
        col2 = describe_columns(vc2)["columns"][1]
        @test col2["mean"] == 5.0
        @test col2["std"] == 0.0
        @test any(w -> occursin("constant", w), col2["warnings"])
    end

    @testset "describe: single observation" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict("x" => [42.0])))
        col = describe_columns(vc)["columns"][1]
        @test col["mean"] == 42.0
        @test col["std"] === nothing
        @test col["q1"] === nothing
    end

    @testset "validation rejects bad input" begin
        @test_throws ValidationError validate_columns(Dict{String,Any}())
        @test_throws ValidationError validate_columns(Dict{String,Any}("columns" => Dict()))
    end

    @testset "validation: strings and booleans rejected" begin
        @test_throws ValidationError validate_columns(
            Dict{String,Any}("columns" => Dict("x" => ["1.0", 2.0]))
        )
        @test_throws ValidationError validate_columns(
            Dict{String,Any}("columns" => Dict("x" => [true, false]))
        )
        @test_throws ValidationError validate_columns(
            Dict{String,Any}("columns" => Dict("" => [1.0]))
        )
    end

    @testset "validation: duplicate names impossible via JSON objects" begin
        # JSON objects cannot hold duplicates; the server preserves object order.
        vc = validate_columns(Dict{String,Any}("columns" => Dict("a" => [1.0], "b" => [2.0])))
        @test vc.names == ["a", "b"] || sort(vc.names) == ["a", "b"]
    end

    @testset "correlation: perfect and undefined" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict(
            "x" => [1.0, 2.0, 3.0, 4.0],
            "y" => [2.0, 4.0, 6.0, 8.0],
            "c" => [7.0, 7.0, 7.0, 7.0],
        )))
        out = correlation_matrix(vc, :pairwise)
        @test out["columns"] == ["x", "y", "c"] || sort(out["columns"]) == ["c", "x", "y"]
        m = out["matrix"]
        ix = findfirst(==("x"), out["columns"])
        iy = findfirst(==("y"), out["columns"])
        ic = findfirst(==("c"), out["columns"])
        @test m[ix][iy] ≈ 1.0
        @test m[ix][ix] ≈ 1.0
        @test m[ix][ic] === nothing # zero variance: undefined, not zero
        @test out["pair_n"][ix][iy] == 4
        @test !isempty(out["warnings"])
    end

    @testset "correlation: pairwise missing policy" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict(
            "x" => [1.0, nothing, 3.0, 4.0],
            "y" => [1.0, 2.0, 3.0, 4.0],
        )))
        out = correlation_matrix(vc, :pairwise)
        ix = findfirst(==("x"), out["columns"])
        iy = findfirst(==("y"), out["columns"])
        @test out["pair_n"][ix][iy] == 3
        @test out["matrix"][ix][iy] ≈ 1.0
        @test out["missing_policy"] == "pairwise"
    end

    @testset "covariance: sample convention" begin
        vc = validate_columns(Dict{String,Any}("columns" => Dict(
            "x" => [1.0, 2.0, 3.0],
            "y" => [1.0, 2.0, 3.0],
        )))
        out = covariance_matrix(vc, :pairwise)
        @test out["method"] == "sample covariance (denominator n-1)"
        ix = findfirst(==("x"), out["columns"])
        @test out["matrix"][ix][ix] ≈ 1.0 # var([1,2,3]) sample = 1
    end

    @testset "linear algebra: square matrix" begin
        M = validate_matrix(Dict{String,Any}("matrix" => [[1.0, 2.0], [3.0, 4.0]]))
        out = analyze_matrix(M)
        @test (out["rows"], out["cols"]) == (2, 2)
        @test out["rank"] == 2
        @test out["determinant"] ≈ -2.0
        @test length(out["singular_values"]) == 2
        @test out["condition_number_2"] !== nothing
        @test out["eigenvalues"] === nothing # non-symmetric
        @test any(w -> occursin("symmetric", w), out["warnings"])
    end

    @testset "linear algebra: non-square matrix" begin
        M = validate_matrix(Dict{String,Any}("matrix" => [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]))
        out = analyze_matrix(M)
        @test (out["rows"], out["cols"]) == (2, 3)
        @test out["rank"] == 2
        @test out["determinant"] === nothing
        @test any(w -> occursin("square", w), out["warnings"])
    end

    @testset "linear algebra: singular matrix" begin
        M = validate_matrix(Dict{String,Any}("matrix" => [[1.0, 2.0], [2.0, 4.0]]))
        out = analyze_matrix(M)
        @test out["rank"] == 1
        @test out["determinant"] ≈ 0.0 atol = 1e-12
        @test any(w -> occursin("rank-deficient", w), out["warnings"])
    end

    @testset "linear algebra: symmetric eigenvalues" begin
        M = validate_matrix(Dict{String,Any}("matrix" => [[2.0, 1.0], [1.0, 2.0]]))
        out = analyze_matrix(M)
        @test out["eigenvalues"] ≈ [3.0, 1.0]
    end

    @testset "matrix validation" begin
        @test_throws ValidationError validate_matrix(Dict{String,Any}())
        @test_throws ValidationError validate_matrix(Dict{String,Any}("matrix" => []))
        @test_throws ValidationError validate_matrix(
            Dict{String,Any}("matrix" => [[1.0, 2.0], [3.0]])
        )
        @test_throws ValidationError validate_matrix(
            Dict{String,Any}("matrix" => [[1.0, "x"], [3.0, 4.0]])
        )
    end

    @testset "finite_or_nothing guards JSON" begin
        @test finite_or_nothing(Inf) === nothing
        @test finite_or_nothing(NaN) === nothing
        @test finite_or_nothing(1.5) == 1.5
        s = JSON3.write(Dict("v" => finite_or_nothing(Inf)))
        @test s == "{\"v\":null}"
    end

    @testset "HTTP: auth and routing" begin
        ok = handle_request(req_post("/v1/statistics/describe",
            Dict("columns" => Dict("x" => [1.0, 2.0]))))
        @test ok.status == 200

        denied = handle_request(req_post("/v1/statistics/describe",
            Dict("columns" => Dict("x" => [1.0])); key="wrong"))
        @test denied.status == 401

        missing = handle_request(req_post("/v1/statistics/describe",
            Dict("columns" => Dict("x" => [1.0]))))
        # valid key, compute shape ok (single obs -> nulls, still 200)
        @test missing.status == 200

        bad = handle_request(req_post("/v1/statistics/describe", Dict("nope" => 1)))
        @test bad.status == 422

        wrong_method = handle_request(HTTP.Request("GET", "/v1/statistics/describe"))
        @test wrong_method.status == 405

        unknown = handle_request(req_post("/v1/nope", Dict()))
        @test unknown.status == 404

        health = handle_request(HTTP.Request("GET", "/health"))
        @test health.status == 200
        @test occursin("nexusai-statistics", String(health.body))
    end

end
