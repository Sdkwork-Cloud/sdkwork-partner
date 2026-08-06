//! Pure commission allocation engine.
//!
//! All amounts are integer minor units (cents) and all ratios are per-10000
//! integers, so the engine never touches floats. Rounding is "round half up
//! per node, last node absorbs the remainder" so the allocated total always
//! equals the base amount.

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

/// Allocate `base_cents` across the ancestor chain.
///
/// - `max_depth == 0` means unlimited; otherwise only nodes with
///   `level_offset < max_depth` receive a share.
/// - Nodes with a zero ratio are skipped.
/// - When the aggregated ratios equal exactly 100%, the last eligible node
///   absorbs the rounding remainder so the total allocated equals `base_cents`.
///   Otherwise each node receives its own rounded share and the unallocated
///   remainder stays with the platform.
/// - If the configured ratios exceed 100%, the allocation is rejected.
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
    let eligible: Vec<&CommissionNode> = nodes
        .iter()
        .filter(|node| {
            node.ratio_per_10000 > 0 && (max_depth == 0 || (node.level_offset as i64) < max_depth)
        })
        .collect();
    if eligible.is_empty() {
        return Ok(Vec::new());
    }
    let total_ratio: i64 = eligible.iter().map(|node| node.ratio_per_10000).sum();
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
            round_half_up(base_cents * node.ratio_per_10000, 10_000)
        };
        allocations.push(CommissionAllocation {
            partner_id: node.partner_id,
            level_offset: node.level_offset,
            ratio_per_10000: node.ratio_per_10000,
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
            level_no: (offset + 1) as i32,
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
    fn allocates_multi_level_with_rounding() {
        // base 100.00 (10000 cents), levels: 20% / 10% / 5% -> 2000 / 1000 / 500
        let nodes = vec![node(1, 0, 2000), node(2, 1, 1000), node(3, 2, 500)];
        let result = allocate_commissions(10_000, &nodes, 0).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].amount_cents, 2_000);
        assert_eq!(result[1].amount_cents, 1_000);
        assert_eq!(result[2].amount_cents, 500);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 3_500);
    }

    #[test]
    fn last_node_absorbs_rounding_remainder() {
        // base 0.01 (1 cent), ratios 33.33% each x3: 0/0/1 -> sum must equal base
        let nodes = vec![node(1, 0, 3333), node(2, 1, 3333), node(3, 2, 3334)];
        let result = allocate_commissions(1, &nodes, 0).unwrap();
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 1);
        assert_eq!(result[0].amount_cents, 0);
        assert_eq!(result[2].amount_cents, 1);
    }

    #[test]
    fn depth_cap_truncates_chain() {
        let nodes = vec![node(1, 0, 1000), node(2, 1, 1000), node(3, 2, 1000)];
        let result = allocate_commissions(10_000, &nodes, 2).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].level_offset, 0);
        assert_eq!(result[1].level_offset, 1);
        let total: i64 = result.iter().map(|a| a.amount_cents).sum();
        assert_eq!(total, 2_000);
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
        let nodes = vec![node(1, 0, 6000), node(2, 1, 5000)];
        assert!(allocate_commissions(10_000, &nodes, 0).is_err());
    }

    #[test]
    fn negative_base_is_rejected() {
        let nodes = vec![node(1, 0, 1000)];
        assert!(allocate_commissions(-1, &nodes, 0).is_err());
    }
}
