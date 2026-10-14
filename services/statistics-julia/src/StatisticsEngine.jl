"""
StatisticsEngine — independent statistical computation service for NexusAI.

Conventions (documented, stable):
- Variance / standard deviation are SAMPLE statistics (denominator n - 1),
  matching Julia's `Statistics.var` / `Statistics.std` defaults.
- Quantiles use linear interpolation (Julia `Statistics.quantile` default).
- Missing values arrive as JSON `null` and are tracked explicitly; empty
  strings are NOT numbers and are rejected at validation.
- Non-finite results are serialized as `null`, never NaN/Infinity.
"""
module StatisticsEngine

include("schemas.jl")
include("statistics.jl")
include("linear_algebra.jl")

end
