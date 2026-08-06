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
