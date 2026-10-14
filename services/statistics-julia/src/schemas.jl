"""
Request validation. Every public entry point receives plain Julia values
decoded from JSON and returns either `ValidatedColumns` or throws
`ValidationError` (mapped to HTTP 422 by the server layer).

Missing-value representation: JSON `null` only. Strings (including "") are
rejected for numeric endpoints.
"""

struct ValidationError <: Exception
    message::String
end

Base.showerror(io::IO, e::ValidationError) = print(io, "ValidationError: ", e.message)

const MAX_COLUMNS = 50
const MAX_VALUES_PER_COLUMN = 100_000
const MAX_TOTAL_VALUES = 1_000_000
const MAX_COLUMN_NAME_LENGTH = 200
const MAX_MATRIX_DIM = 200

struct ValidatedColumns
    names::Vector{String}
    # Each inner vector preserves row order; `missing` == JSON null.
    columns::Vector{Vector{Union{Float64,Missing}}}
end

"""
    validate_columns(payload) -> ValidatedColumns

Expects `payload["columns"]` to be an object mapping column names to arrays
of numbers-or-null. Preserves insertion order of the JSON object.
"""
function validate_columns(payload::Dict{String,Any})::ValidatedColumns
    raw = get(payload, "columns", nothing)
    if !(raw isa AbstractDict)
        throw(ValidationError("body must contain an object field 'columns'"))
    end
    names = String.(collect(keys(raw)))
    if isempty(names)
        throw(ValidationError("at least one column is required"))
    end
    if length(names) > MAX_COLUMNS
        throw(ValidationError("at most $MAX_COLUMNS columns are allowed"))
    end
    seen = Set{String}()
    total = 0
    columns = Vector{Vector{Union{Float64,Missing}}}()
    for name in names
        if isempty(strip(name))
            throw(ValidationError("column names must be non-empty"))
        end
        if length(name) > MAX_COLUMN_NAME_LENGTH
            throw(ValidationError("column name exceeds maximum length"))
        end
        if name in seen
            throw(ValidationError("duplicate column name: \"$(name)\""))
        end
        push!(seen, name)
        values = raw[name]
        if !(values isa AbstractVector)
            throw(ValidationError("column \"$(name)\" must be an array"))
        end
        if length(values) > MAX_VALUES_PER_COLUMN
            throw(ValidationError("column \"$(name)\" exceeds maximum length"))
        end
        total += length(values)
        parsed = Vector{Union{Float64,Missing}}(undef, length(values))
        for (i, v) in enumerate(values)
            if v === nothing || v === missing
                parsed[i] = missing
            elseif v isa Bool
                throw(ValidationError("column \"$(name)\" contains a boolean, expected number or null"))
            elseif v isa Number
                f = Float64(v)
                if !isfinite(f)
                    throw(ValidationError("column \"$(name)\" contains a non-finite value"))
                end
                parsed[i] = f
            else
                throw(ValidationError("column \"$(name)\" contains a non-numeric value"))
            end
        end
        push!(columns, parsed)
    end
    if total > MAX_TOTAL_VALUES
        throw(ValidationError("payload exceeds maximum total values"))
    end
    if total == 0
        throw(ValidationError("no observations provided"))
    end
    return ValidatedColumns(names, columns)
end

"""
    validate_matrix(payload) -> Matrix{Float64}

Expects `payload["matrix"]` to be an array of equal-length numeric arrays.
"""
function validate_matrix(payload::Dict{String,Any})::Matrix{Float64}
    raw = get(payload, "matrix", nothing)
    if !(raw isa AbstractVector) || isempty(raw)
        throw(ValidationError("body must contain a non-empty 'matrix' array"))
    end
    nrows = length(raw)
    if nrows > MAX_MATRIX_DIM
        throw(ValidationError("matrix exceeds maximum dimension $MAX_MATRIX_DIM"))
    end
    first = raw[1]
    if !(first isa AbstractVector) || isempty(first)
        throw(ValidationError("matrix rows must be non-empty arrays"))
    end
    ncols = length(first)
    if ncols > MAX_MATRIX_DIM
        throw(ValidationError("matrix exceeds maximum dimension $MAX_MATRIX_DIM"))
    end
    if nrows * ncols > MAX_TOTAL_VALUES
        throw(ValidationError("matrix exceeds maximum total values"))
    end
    M = Matrix{Float64}(undef, nrows, ncols)
    for (i, row) in enumerate(raw)
        if !(row isa AbstractVector) || length(row) != ncols
            throw(ValidationError("all matrix rows must have length $ncols"))
        end
        for (j, v) in enumerate(row)
            if v isa Bool || !(v isa Number)
                throw(ValidationError("matrix must contain only numbers"))
            end
            f = Float64(v)
            if !isfinite(f)
                throw(ValidationError("matrix must contain only finite values"))
            end
            M[i, j] = f
        end
    end
    return M
end

"""Missing-data policy shared by correlation/covariance/compare."""
function validate_missing_policy(payload::Dict{String,Any})::Symbol
    options = get(payload, "options", Dict{String,Any}())
    policy = options isa AbstractDict ? get(options, "missing_policy", "pairwise") : "pairwise"
    if policy == "pairwise"
        return :pairwise
    elseif policy == "listwise"
        return :listwise
    else
        throw(ValidationError("options.missing_policy must be 'pairwise' or 'listwise'"))
    end
end

"""Replace non-finite floats with `nothing` so JSON output is always valid."""
finite_or_nothing(x::Real) = isfinite(Float64(x)) ? Float64(x) : nothing
finite_or_nothing(::Missing) = nothing
finite_or_nothing(::Nothing) = nothing
