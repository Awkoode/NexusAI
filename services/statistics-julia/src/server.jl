#!/usr/bin/env julia
"""
Internal HTTP API for the NexusAI statistics engine.

Only the Node.js backend calls this service (header `X-Julia-Service-Key`).
The frontend never talks to it directly.
"""

push!(LOAD_PATH, @__DIR__)
include(joinpath(@__DIR__, "StatisticsEngine.jl"))

using .StatisticsEngine
using .StatisticsEngine: validate_columns, validate_matrix, validate_missing_policy,
    describe_columns, correlation_matrix, covariance_matrix, analyze_matrix,
    ValidationError
using HTTP
using JSON3

const SERVICE_NAME = "nexusai-statistics"
const SERVICE_VERSION = "0.1.0"
const MAX_BODY_BYTES = 10 * 1024 * 1024

service_key() = get(ENV, "JULIA_SERVICE_KEY", "dev-julia-service-key")

function json_response(status::Int, body)::HTTP.Response
    return HTTP.Response(status, ["Content-Type" => "application/json"], JSON3.write(body))
end

function error_response(status::Int, code::String, message::String)::HTTP.Response
    return json_response(status, Dict{String,Any}(
        "error" => Dict{String,Any}("code" => code, "message" => message),
    ))
end

function read_json_body(req::HTTP.Request)::Dict{String,Any}
    # HTTP.jl v2 wraps the body in HTTP.BytesBody; convert explicitly.
    raw = try
        Vector{UInt8}(req.body)
    catch
        UInt8[]
    end
    if length(raw) > MAX_BODY_BYTES
        throw(ValidationError("request body exceeds maximum size"))
    end
    if isempty(raw)
        throw(ValidationError("empty request body"))
    end
    parsed = try
        JSON3.read(String(copy(raw)), Dict{String,Any})
    catch
        throw(ValidationError("malformed JSON body"))
    end
    if !(parsed isa Dict{String,Any})
        throw(ValidationError("body must be a JSON object"))
    end
    return parsed
end

function check_auth(req::HTTP.Request)::Union{HTTP.Response,Nothing}
    key = HTTP.header(req, "X-Julia-Service-Key", "")
    if isempty(key) || key != service_key()
        return error_response(401, "INVALID_SERVICE_CREDENTIALS", "invalid service credentials")
    end
    return nothing
end

function handle_request(req::HTTP.Request)::HTTP.Response
    method = String(req.method)
    path = HTTP.URI(req.target).path

    if method == "GET" && path == "/health"
        return json_response(200, Dict{String,Any}(
            "status" => "ok",
            "service" => SERVICE_NAME,
            "version" => SERVICE_VERSION,
            "julia" => string(VERSION),
        ))
    end

    if method != "POST"
        return error_response(405, "METHOD_NOT_ALLOWED", "only GET /health and POST /v1/* are supported")
    end

    if !startswith(path, "/v1/")
        return error_response(404, "NOT_FOUND", "unknown endpoint")
    end

    auth_failure = check_auth(req)
    if auth_failure !== nothing
        return auth_failure
    end

    try
        payload = read_json_body(req)
        if path == "/v1/statistics/describe"
            vc = validate_columns(payload)
            return json_response(200, describe_columns(vc))
        elseif path == "/v1/statistics/correlation"
            vc = validate_columns(payload)
            policy = validate_missing_policy(payload)
            return json_response(200, correlation_matrix(vc, policy))
        elseif path == "/v1/statistics/covariance"
            vc = validate_columns(payload)
            policy = validate_missing_policy(payload)
            return json_response(200, covariance_matrix(vc, policy))
        elseif path == "/v1/linear-algebra/analyze"
            M = validate_matrix(payload)
            return json_response(200, analyze_matrix(M))
        else
            return error_response(404, "NOT_FOUND", "unknown endpoint")
        end
    catch e
        if e isa ValidationError
            @info "validation error" path=path message=e.message
            return error_response(422, "VALIDATION_ERROR", e.message)
        end
        @error "internal error" path=path exception=string(typeof(e))
        return error_response(500, "INTERNAL_ERROR", "computation failed")
    end
end

function main()
    port = parse(Int, get(ENV, "PORT", "8001"))
    @info "statistics engine starting" service=SERVICE_NAME version=SERVICE_VERSION port=port julia=string(VERSION)
    HTTP.serve(handle_request, "0.0.0.0", port)
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
