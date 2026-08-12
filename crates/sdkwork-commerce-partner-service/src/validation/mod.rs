use sdkwork_contract_service::CommerceServiceError;

/// Require a non-empty trimmed string field.
pub fn require_non_empty(field: &str, value: &str) -> Result<String, CommerceServiceError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(CommerceServiceError::validation(format!(
            "{field} must not be empty"
        )));
    }
    Ok(trimmed.to_string())
}

/// Require a non-negative integer identifier.
pub fn require_non_negative_id(field: &str, value: i64) -> Result<i64, CommerceServiceError> {
    if value < 0 {
        return Err(CommerceServiceError::validation(format!(
            "{field} must be a non-negative integer"
        )));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn require_non_empty_trims_and_returns_trimmed_value() {
        assert_eq!(require_non_empty("name", "  alice  ").unwrap(), "alice");
    }

    #[test]
    fn require_non_empty_rejects_blank_and_whitespace() {
        assert!(require_non_empty("name", "").is_err());
        assert!(require_non_empty("name", "   ").is_err());
        assert!(require_non_empty("name", "\t\n").is_err());
    }

    #[test]
    fn require_non_negative_id_accepts_zero_and_positive() {
        assert_eq!(require_non_negative_id("partnerId", 0).unwrap(), 0);
        assert_eq!(require_non_negative_id("partnerId", 42).unwrap(), 42);
    }

    #[test]
    fn require_non_negative_id_rejects_negative() {
        assert!(require_non_negative_id("partnerId", -1).is_err());
    }
}
