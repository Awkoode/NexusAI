"""
Descriptive statistics, Pearson correlation and sample covariance.

Conventions:
- `std`/`var` are SAMPLE statistics (corrected=true, denominator n-1).
- Quantiles use linear interpolation (Statistics.quantile default).
- `missing` values are excluded per column (describe) or per the chosen
  missing-data policy (correlation/covariance).
- Undefined results (empty input, zero variance, n < 2) are returned as
  `nothing` (= JSON null) with an explanatory warning — never 0, never NaN.
"""

using Statistics

"""Valid observations of one column (missing removed, order preserved)."""
valid_values(col::Vector{Union{Float64,Missing}}) = collect(skipmissing(col))

function describe_column(name::String, col::Vector{Union{Float64,Missing}})::Dict{String,Any}
    n_missing = count(ismissing, col)
    vals = valid_values(col)
    n = length(vals)
    warnings = String[]
    if n == 0
        push!(warnings, "column \"$(name)\" has no valid observations")
        return Dict{String,Any}(
            "name" => name, "count" => 0, "missing" => n_missing,
            "mean" => nothing, "median" => nothing, "std" => nothing,
            "variance" => nothing, "min" => nothing, "max" => nothing,
            "q1" => nothing, "q3" => nothing,
            "distinct" => 0, "warnings" => warnings,
        )
    end
    distinct = length(Set(vals))
    if distinct == 1
        push!(warnings, "column \"$(name)\" is constant")
    end
    std_v, var_v, q1, q3 = nothing, nothing, nothing, nothing
    if n >= 2
        std_v = finite_or_nothing(std(vals; corrected=true))
        var_v = finite_or_nothing(var(vals; corrected=true))
        q1 = finite_or_nothing(quantile(vals, 0.25))
        q3 = finite_or_nothing(quantile(vals, 0.75))
    else
        push!(warnings, "column \"$(name)\" has a single observation: std/var/quartiles undefined")
    end
    return Dict{String,Any}(
        "name" => name, "count" => n, "missing" => n_missing,
        "mean" => finite_or_nothing(mean(vals)),
        "median" => finite_or_nothing(median(vals)),
        "std" => std_v, "variance" => var_v,
        "min" => finite_or_nothing(minimum(vals)),
        "max" => finite_or_nothing(maximum(vals)),
        "q1" => q1, "q3" => q3,
        "distinct" => distinct, "warnings" => warnings,
    )
end

function describe_columns(vc::ValidatedColumns)::Dict{String,Any}
    cols = [describe_column(vc.names[i], vc.columns[i]) for i in eachindex(vc.names)]
    return Dict{String,Any}(
        "columns" => cols,
        "conventions" => Dict{String,Any}(
            "std" => "sample (denominator n-1)",
            "quantiles" => "linear interpolation",
            "missing" => "excluded per column; JSON null only",
        ),
    )
end

"""Row mask for the listwise policy (rows with no missing in ANY column)."""
function listwise_mask(vc::ValidatedColumns)::BitVector
    nrows = maximum(length(c) for c in vc.columns; init=0)
    mask = trues(nrows)
    for col in vc.columns, i in eachindex(col)
        if i <= nrows && ismissing(col[i])
            mask[i] = false
        end
    end
    # Columns may differ in length; only overlapping rows are usable.
    minlen = minimum(length(c) for c in vc.columns; init=0)
    if minlen < nrows
        mask[(minlen+1):end] .= false
    end
    return mask
end

"""Paired valid values of two columns under the pairwise policy."""
function pairwise_values(
    a::Vector{Union{Float64,Missing}}, b::Vector{Union{Float64,Missing}}
)::Tuple{Vector{Float64},Vector{Float64}}
    n = min(length(a), length(b))
    xs = Float64[]
    ys = Float64[]
    for i in 1:n
        ai, bi = a[i], b[i]
        if !ismissing(ai) && !ismissing(bi)
            push!(xs, ai)
            push!(ys, bi)
        end
    end
    return xs, ys
end

function pearson(xs::Vector{Float64}, ys::Vector{Float64})::Union{Float64,Nothing}
    n = length(xs)
    if n < 2
        return nothing
    end
    mx, my = mean(xs), mean(ys)
    dx = xs .- mx
    dy = ys .- my
    denom = sqrt(sum(dx .^ 2) * sum(dy .^ 2))
    if denom == 0.0
        return nothing # zero variance: correlation undefined, NOT zero
    end
    r = sum(dx .* dy) / denom
    return isfinite(r) ? r : nothing
end

function sample_covariance(xs::Vector{Float64}, ys::Vector{Float64})::Union{Float64,Nothing}
    n = length(xs)
    if n < 2
        return nothing
    end
    mx, my = mean(xs), mean(ys)
    c = sum((xs .- mx) .* (ys .- my)) / (n - 1)
    return isfinite(c) ? c : nothing
end

function correlation_matrix(vc::ValidatedColumns, policy::Symbol)::Dict{String,Any}
    k = length(vc.names)
    mat = Matrix{Union{Float64,Nothing}}(undef, k, k)
    nmat = Matrix{Int}(undef, k, k)
    warnings = String[]
    mask = policy == :listwise ? listwise_mask(vc) : nothing
    for i in 1:k, j in 1:k
        if i == j
            # Diagonal: 1.0 iff the column has variation under the policy.
            xs = if policy == :listwise
                valid_values_masked(vc.columns[i], mask)
            else
                first(pairwise_values(vc.columns[i], vc.columns[i]))
            end
            mat[i, j] = length(xs) >= 2 && std(xs; corrected=true) > 0 ? 1.0 : nothing
            nmat[i, j] = length(xs)
            if mat[i, j] === nothing
                push!(warnings, "column \"$(vc.names[i])\" has no variation: diagonal undefined")
            end
        else
            xs, ys = if policy == :listwise
                x_all = valid_values_masked(vc.columns[i], mask)
                y_all = valid_values_masked(vc.columns[j], mask)
                (x_all, y_all)
            else
                pairwise_values(vc.columns[i], vc.columns[j])
            end
            r = pearson(xs, ys)
            mat[i, j] = r
            nmat[i, j] = length(xs)
            if r === nothing
                push!(warnings, "pair ($(vc.names[i]), $(vc.names[j])): correlation undefined (n=$(length(xs)))")
            end
        end
    end
    return Dict{String,Any}(
        "columns" => vc.names,
        "matrix" => [[mat[i, j] for j in 1:k] for i in 1:k],
        "pair_n" => [[nmat[i, j] for j in 1:k] for i in 1:k],
        "missing_policy" => String(policy),
        "method" => "pearson",
        "warnings" => unique(warnings),
    )
end

"""Values of a column restricted to a listwise row mask."""
function valid_values_masked(
    col::Vector{Union{Float64,Missing}}, mask::Union{BitVector,Nothing}
)::Vector{Float64}
    if mask === nothing
        return valid_values(col)
    end
    out = Float64[]
    for i in eachindex(col)
        if i <= length(mask) && mask[i] && !ismissing(col[i])
            push!(out, col[i])
        end
    end
    return out
end

function covariance_matrix(vc::ValidatedColumns, policy::Symbol)::Dict{String,Any}
    k = length(vc.names)
    mat = Matrix{Union{Float64,Nothing}}(undef, k, k)
    nmat = Matrix{Int}(undef, k, k)
    warnings = String[]
    mask = policy == :listwise ? listwise_mask(vc) : nothing
    for i in 1:k, j in 1:k
        xs, ys = if policy == :listwise
            (valid_values_masked(vc.columns[i], mask), valid_values_masked(vc.columns[j], mask))
        else
            pairwise_values(vc.columns[i], vc.columns[j])
        end
        c = sample_covariance(xs, ys)
        mat[i, j] = c
        nmat[i, j] = length(xs)
        if c === nothing
            push!(warnings, "pair ($(vc.names[i]), $(vc.names[j])): covariance undefined (n=$(length(xs)))")
        end
    end
    return Dict{String,Any}(
        "columns" => vc.names,
        "matrix" => [[mat[i, j] for j in 1:k] for i in 1:k],
        "pair_n" => [[nmat[i, j] for j in 1:k] for i in 1:k],
        "missing_policy" => String(policy),
        "method" => "sample covariance (denominator n-1)",
        "warnings" => unique(warnings),
    )
end
