//! Pure commission allocation engine.
//!
//! All amounts are integer minor units (cents) and all ratios are per-10000
//! integers, so the engine never touches floats. Rounding is "round half up
//! per node, last node absorbs the remainder" so the allocated total always
//! equals the base amount.
//!
//! # Commission base (利润返佣)
//!
//! `base_cents` is the platform's profit base for the transaction: customer
//! revenue commissions are computed on `revenue × profit_margin_ratio`
//! (converted by `domain::profit_base_cents` at the settlement call site),
//! never on the full customer revenue. Join-fee commissions pass the full
//! join fee as the base. This module only allocates whatever base it is
//! given.
//!
//! # Differential (级差) allocation
//!
//! Ratios follow the industry-standard differential scheme used by cloud
//! vendor partner programs and distribution channels: the partner that owns
//! the revenue source keeps its full level ratio, and each ancestor earns the
//! positive difference between its own level ratio and the highest ratio
//! below it in the chain. The aggregated payout therefore equals the highest
//! ratio in the chain and can never exceed it, which keeps the platform
//! margin bounded by construction regardless of chain depth.

use sdkwork_contract_service::CommerceServiceError;

/// One node of the ancestor chain: the partner that earns commission and its
/// level configuration at settlement time.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommissionNode {
    pub partner_id: i64,
    /// 0 = the partner that owns the revenue source, 1 = direct parent, ...
    pub level_offset: i32,
    pub level_no: i32,
    /// Commission ratio for this node's level, per-10000 (20.00% -> 2000).
    pub ratio_per_10000: i64,
}

/// One allocation decision produced by the engine.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommissionAllocation {
    pub partner_id: i64,
    pub level_offset: i32,
    /// Effective (级差) ratio applied to this node, per-10000. For the direct
    /// earner this equals its level ratio; for ancestors it is the positive
    /// difference against the node below.
    pub ratio_per_10000: i64,
    pub amount_cents: i64,
}

fn round_half_up(numerator: i64, denominator: i64) -> i64 {
    // numerator >= 0, denominator > 0
    let (quotient, remainder) = (numerator / denominator, numerator % denominator);
    if remainder * 2 >= denominator {
        quotient + 1
    } else {
        quotient
    }
}

/// Allocate `base_cents` across the ancestor chain using differential (级差)
/// allocation.
///
/// - `max_depth == 0` means unlimited; otherwise only nodes with
///   `level_offset < max_depth` receive a share.
/// - Nodes with a zero ratio are skipped. The first eligible node (the one
///   closest to the revenue source) keeps its full level ratio; each
///   subsequent node earns only the positive difference between its own ratio
///   and the highest ratio below it in the chain. The aggregated payout
///   therefore equals the highest ratio in the chain and never exceeds it.
/// - When the aggregated ratios equal exactly 100%, the last eligible node
///   absorbs the rounding remainder so the total allocated equals `base_cents`.
///   Otherwise each node receives its own rounded share and the unallocated
///   remainder stays with the platform.
/// - If the aggregated ratios exceed 100%, the allocation is rejected.
pub fn allocate_commissions(
    base_cents: i64,
    nodes: &[CommissionNode],
    max_depth: i64,
) -> Result<Vec<CommissionAllocation>, CommerceServiceError> {
    if base_cents < 0 {
        return Err(CommerceServiceError::validation(
            "commission base amount must not be negative",
        ));
    }
    if max_depth < 0 {
        return Err(CommerceServiceError::validation(
            "max commission depth must not be negative",
        ));
    }
    let mut eligible: Vec<&CommissionNode> = nodes
        .iter()
        .filter(|node| {
            node.ratio_per_10000 > 0 && (max_depth == 0 || (node.level_offset as i64) < max_depth)
        })
        .collect();
    if eligible.is_empty() {
        return Ok(Vec::new());
    }
    // The callers already build the chain in order, but sort defensively so
    // the differential math never depends on input order.
    eligible.sort_by_key(|node| node.level_offset);
    // Differential (级差): the direct earner keeps its full ratio; each
    // ancestor earns the positive difference between its own ratio and the
    // highest ratio seen below it in the chain. Each level therefore claims
    // only the increment over the best-rated node below it, and the sum
    // telescopes to the highest ratio in the chain — never above it.
    let mut effective_ratios = Vec::with_capacity(eligible.len());
    let mut best_below = 0_i64;
    for node in &eligible {
        let effective = (node.ratio_per_10000 - best_below).max(0);
        best_below = best_below.max(node.ratio_per_10000);
        effective_ratios.push(effective);
    }
    let total_ratio: i64 = effective_ratios.iter().sum();
    if total_ratio > 10_000 {
        return Err(CommerceServiceError::validation(format!(
            "aggregated commission ratio {total_ratio}/10000 exceeds 100%"
        )));
    }
    let absorbs_remainder = total_ratio == 10_000;

    let mut allocations = Vec::with_capacity(eligible.len());
    for (index, node) in eligible.iter().enumerate() {
        let is_last = index + 1 == eligible.len();
        let amount_cents = if is_last && absorbs_remainder {
            let allocated: i64 = allocations
                .iter()
                .map(|a: &CommissionAllocation| a.amount_cents)
                .sum();
            base_cents - allocated
        } else {
            round_half_up(base_cents * effective_ratios[index], 10_000)
        };
        allocations.push(CommissionAllocation {
            partner_id: node.partner_id,
            level_offset: node.level_offset,
            ratio_per_10000: effective_ratios[index],
            amount_cents,
        });
    }
    Ok(allocations)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(partner_id: i64, offset: i32, ratio: i64) -> CommissionNode {
        CommissionNode {
            partner_id,
            level_offset: offset,
            level_no: offset + 1,
            ratio_per_10000: ratio,
        }
    }

    #[test]
    fn allocates_single_node_full_ratio() {
        let nodes = vec![node(1, 0, 2000)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].partner_id, 1);
        assert_eq!(result[0].amount_cents, 2_000);
    }

    #[test]
    fn direct_partner_keeps_full_ratio_above_lower_ancestors() {
        // Direct partner at the top of the ladder (30%) with lower-rated
        // ancestors earns its full ratio; the ancestors earn 0.
        let nodes = vec![node(1, 0, 3000), node(2, 1, 2500), node(3, 2, 2000)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].ratio_per_10000, 3_000);
        assert_eq!(result[0].amount_cents, 3_000);
        assert_eq!(result[1].ratio_per_10000, 0);
        assert_eq!(result[2].ratio_per_10000, 0);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 3_000);
    }

    #[test]
    fn differential_allocation_telescopes_to_top_ratio() {
        // Chain L1 10% / L3 20% / L5 30%: direct keeps 10%, each ancestor
        // earns the 10% difference; the aggregated payout equals the top 30%.
        let nodes = vec![node(1, 0, 1000), node(2, 1, 2000), node(3, 2, 3000)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].ratio_per_10000, 1_000);
        assert_eq!(result[0].amount_cents, 1_000);
        assert_eq!(result[1].ratio_per_10000, 1_000);
        assert_eq!(result[1].amount_cents, 1_000);
        assert_eq!(result[2].ratio_per_10000, 1_000);
        assert_eq!(result[2].amount_cents, 1_000);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 3_000);
    }

    #[test]
    fn non_monotonic_chain_zeroes_lower_ancestors() {
        // 15% / 10% / 20%: the 10% ancestor earns 0 (below the direct
        // partner), the 20% ancestor earns the 5% increment over the highest
        // ratio below it; total equals the highest ratio.
        let nodes = vec![node(1, 0, 1500), node(2, 1, 1000), node(3, 2, 2000)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result[0].amount_cents, 1_500);
        assert_eq!(result[1].amount_cents, 0);
        assert_eq!(result[2].amount_cents, 500);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 2_000);
    }

    #[test]
    fn aggregated_payout_never_exceeds_highest_ratio() {
        // Property: for any chain the aggregated ratio equals the maximum
        // ratio in the chain, so the payout is bounded by construction.
        let cases = vec![
            (
                vec![node(1, 0, 500), node(2, 1, 4000), node(3, 2, 1000)],
                4_000,
            ),
            (vec![node(1, 0, 3000), node(2, 1, 3000)], 3_000),
            (
                vec![
                    node(1, 0, 1000),
                    node(2, 1, 1500),
                    node(3, 2, 1200),
                    node(4, 3, 2500),
                ],
                2_500,
            ),
        ];
        for (nodes, expected_total) in cases {
            let result = allocate_commissions(10_000, &nodes, 0).unwrap();
            let total_ratio: i64 = result.iter().map(|a| a.ratio_per_10000).sum();
            assert_eq!(total_ratio, expected_total);
        }
    }

    #[test]
    fn differential_is_bounded_for_all_small_chains() {
        // Exhaustive property test: for every 3-node chain drawn from a
        // realistic ratio ladder (0% to 60%), the aggregated payout equals
        // the highest ratio in the chain — the margin-safety invariant.
        let ratios = [0, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000];
        for &r0 in &ratios {
            for &r1 in &ratios {
                for &r2 in &ratios {
                    let nodes = vec![node(1, 0, r0), node(2, 1, r1), node(3, 2, r2)];
                    let result = allocate_commissions(10_000, &nodes, 0).unwrap();
                    let total_ratio: i64 = result.iter().map(|a| a.ratio_per_10000).sum();
                    assert_eq!(
                        total_ratio,
                        r0.max(r1).max(r2),
                        "chain ratios {r0}/{r1}/{r2} must aggregate to the max"
                    );
                }
            }
        }
    }

    #[test]
    fn differential_is_bounded_for_four_node_chains() {
        // Exhaustive 4-node property test over a coarser ratio ladder; the
        // invariant must hold for deeper chains too.
        let ratios = [0, 1000, 1500, 2000, 3000, 5000];
        for &r0 in &ratios {
            for &r1 in &ratios {
                for &r2 in &ratios {
                    for &r3 in &ratios {
                        let nodes = vec![
                            node(1, 0, r0),
                            node(2, 1, r1),
                            node(3, 2, r2),
                            node(4, 3, r3),
                        ];
                        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
                        let total_ratio: i64 = result.iter().map(|a| a.ratio_per_10000).sum();
                        assert_eq!(
                            total_ratio,
                            r0.max(r1).max(r2).max(r3),
                            "chain ratios {r0}/{r1}/{r2}/{r3} must aggregate to the max"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn differential_respects_depth_cap_in_aggregate() {
        // With a depth cap the aggregate is bounded by the highest ratio
        // among the eligible (uncapped) nodes only.
        let nodes = vec![node(1, 0, 1000), node(2, 1, 3000), node(3, 2, 5000)];
        let result = allocate_commissions(10_000, &nodes, 2).unwrap();
        assert_eq!(result.len(), 2);
        let total_ratio: i64 = result.iter().map(|a| a.ratio_per_10000).sum();
        assert_eq!(total_ratio, 3_000);
        assert_eq!(result[0].amount_cents, 1_000);
        assert_eq!(result[1].amount_cents, 2_000);
    }

    #[test]
    fn last_node_absorbs_rounding_remainder() {
        // Effective ratios 50% + 50% = 100%: base 0.01 -> 1/0 with the last
        // node absorbing the rounding remainder so the sum equals the base.
        let nodes = vec![node(1, 0, 5000), node(2, 1, 10000)];
        let result = allocate_commissions(1, &nodes, 0).unwrap();
        assert_eq!(result[0].amount_cents, 1);
        assert_eq!(result[1].amount_cents, 0);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 1);
    }

    #[test]
    fn depth_cap_truncates_chain() {
        // Equal ratios across the chain: the direct partner keeps its full
        // ratio and the parent earns 0 (no differential remains).
        let nodes = vec![node(1, 0, 1000), node(2, 1, 1000), node(3, 2, 1000)];
        let result = allocate_commissions(10_000, &nodes, 2).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].level_offset, 0);
        assert_eq!(result[1].level_offset, 1);
        assert_eq!(result[0].amount_cents, 1_000);
        assert_eq!(result[1].amount_cents, 0);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 1_000);
    }

    #[test]
    fn zero_ratio_nodes_are_skipped() {
        let nodes = vec![node(1, 0, 0), node(2, 1, 1000)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].partner_id, 2);
        assert_eq!(result[0].amount_cents, 1_000);
    }

    #[test]
    fn empty_chain_yields_no_allocations() {
        let result = allocate_commissions(10_000, &[], 0).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn over_100_percent_is_rejected() {
        // A single level ratio above 100% pushes the telescoped aggregate
        // above 100%.
        let nodes = vec![node(1, 0, 6000), node(2, 1, 11000)];
        assert!(allocate_commissions(10_000, &nodes, 0).is_err());
    }

    #[test]
    fn negative_base_is_rejected() {
        let nodes = vec![node(1, 0, 1000)];
        assert!(allocate_commissions(-1, &nodes, 0).is_err());
    }
}
