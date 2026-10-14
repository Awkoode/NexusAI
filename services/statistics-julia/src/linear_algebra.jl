"""
Dense linear-algebra analysis for bounded matrices.

Scope is deliberately narrow: rank, determinant (square only), 2-norm
condition number, truncated SVD and — only for (approximately) symmetric
square matrices — eigenvalues. No matrix inverse is offered: an inverse of
an ill-conditioned or singular matrix would be numerically meaningless.
"""

using LinearAlgebra

const MAX_SVD_VALUES = 20
const SYMMETRY_TOL = 1e-10

"""Approximate symmetry check (LinearAlgebra.issymmetric has no tolerance kwarg)."""
function is_approx_symmetric(M::Matrix{Float64})::Bool
    m, n = size(M)
    m == n || return false
    scale = max(1.0, maximum(abs, M))
    return maximum(abs, M .- transpose(M)) <= SYMMETRY_TOL * scale
end

"""Frobenius-style finiteness already guaranteed at validation; recheck cheaply."""
function analyze_matrix(M::Matrix{Float64})::Dict{String,Any}
    m, n = size(M)
    warnings = String[]
    if !all(isfinite, M)
        throw(ValidationError("matrix must contain only finite values"))
    end

    r = rank(M)
    svals = svdvals(M)
    top_svd = [finite_or_nothing(s) for s in svals[1:min(length(svals), MAX_SVD_VALUES)]]
    s_max = maximum(svals)
    s_min = minimum(svals)
    # 2-norm condition number κ = σmax/σmin; Inf for rank-deficient matrices.
    cond_number::Union{Float64,Nothing} = (s_min > 0 && isfinite(s_max)) ? s_max / s_min : nothing
    if r < min(m, n)
        push!(warnings, "matrix is rank-deficient (rank $r of min($m, $n))")
    end
    if cond_number !== nothing && cond_number > 1e12
        push!(warnings, "matrix is ill-conditioned (κ ≈ $(cond_number)); results need care")
    end

    result = Dict{String,Any}(
        "rows" => m,
        "cols" => n,
        "rank" => r,
        "singular_values" => top_svd,
        "singular_values_truncated" => length(svals) > MAX_SVD_VALUES,
        "condition_number_2" => finite_or_nothing(cond_number),
        "determinant" => nothing,
        "eigenvalues" => nothing,
        "warnings" => warnings,
    )

    if m == n
        d = det(M)
        result["determinant"] = finite_or_nothing(d)
        if is_approx_symmetric(M)
            ev = eigvals(Symmetric(M))
            result["eigenvalues"] = [finite_or_nothing(v) for v in sort(ev; rev=true)]
        else
            push!(
                result["warnings"],
                "eigenvalues reported only for (approximately) symmetric matrices",
            )
        end
    else
        push!(result["warnings"], "determinant defined only for square matrices")
    end
    return result
end
