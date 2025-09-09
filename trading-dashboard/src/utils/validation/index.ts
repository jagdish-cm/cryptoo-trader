/**
 * Validation utilities for form inputs and data validation
 */

import { ValidationError } from "../../types/common/base";

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates if a value is required (not empty)
 */
export const validateRequired = (
  value: unknown,
  fieldName: string
): ValidationError | null => {
  if (value === null || value === undefined || value === "") {
    return {
      field: fieldName,
      message: `${fieldName} is required`,
      code: "VALIDATION_REQUIRED",
    };
  }
  return null;
};

/**
 * Validates email format
 */
export const validateEmail = (
  email: string,
  fieldName: string = "Email"
): ValidationError | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      field: fieldName,
      message: "Please enter a valid email address",
      code: "VALIDATION_EMAIL_FORMAT",
    };
  }
  return null;
};

/**
 * Validates number range
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationError | null => {
  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`,
      code: "VALIDATION_NUMBER_RANGE",
    };
  }
  return null;
};

/**
 * Validates minimum number value
 */
export const validateMinNumber = (
  value: number,
  min: number,
  fieldName: string
): ValidationError | null => {
  if (value < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min}`,
      code: "VALIDATION_MIN_NUMBER",
    };
  }
  return null;
};

/**
 * Validates maximum number value
 */
export const validateMaxNumber = (
  value: number,
  max: number,
  fieldName: string
): ValidationError | null => {
  if (value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must not exceed ${max}`,
      code: "VALIDATION_MAX_NUMBER",
    };
  }
  return null;
};

/**
 * Validates string length
 */
export const validateStringLength = (
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): ValidationError | null => {
  if (value.length < minLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${minLength} characters`,
      code: "VALIDATION_MIN_LENGTH",
    };
  }
  if (value.length > maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} must not exceed ${maxLength} characters`,
      code: "VALIDATION_MAX_LENGTH",
    };
  }
  return null;
};

/**
 * Validates trading symbol format
 */
export const validateTradingSymbol = (
  symbol: string,
  fieldName: string = "Symbol"
): ValidationError | null => {
  const symbolRegex = /^[A-Z]{2,10}\/[A-Z]{2,10}$/;
  if (!symbolRegex.test(symbol)) {
    return {
      field: fieldName,
      message: "Symbol must be in format BTC/USDT",
      code: "VALIDATION_SYMBOL_FORMAT",
    };
  }
  return null;
};

/**
 * Validates percentage value (0-100)
 */
export const validatePercentage = (
  value: number,
  fieldName: string,
  allowNegative: boolean = false
): ValidationError | null => {
  const min = allowNegative ? -100 : 0;
  const max = 100;

  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min}% and ${max}%`,
      code: "VALIDATION_PERCENTAGE_RANGE",
    };
  }
  return null;
};

/**
 * Validates price value (positive number)
 */
export const validatePrice = (
  price: number,
  fieldName: string = "Price"
): ValidationError | null => {
  if (price <= 0) {
    return {
      field: fieldName,
      message: `${fieldName} must be greater than 0`,
      code: "VALIDATION_POSITIVE_NUMBER",
    };
  }
  return null;
};

/**
 * Validates quantity value (positive number)
 */
export const validateQuantity = (
  quantity: number,
  fieldName: string = "Quantity"
): ValidationError | null => {
  if (quantity <= 0) {
    return {
      field: fieldName,
      message: `${fieldName} must be greater than 0`,
      code: "VALIDATION_POSITIVE_NUMBER",
    };
  }
  return null;
};

/**
 * Validates date range
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date,
  fieldName: string = "Date range"
): ValidationError | null => {
  if (startDate >= endDate) {
    return {
      field: fieldName,
      message: "Start date must be before end date",
      code: "VALIDATION_DATE_RANGE",
    };
  }
  return null;
};

/**
 * Validates that a date is not in the future
 */
export const validatePastDate = (
  date: Date,
  fieldName: string
): ValidationError | null => {
  if (date > new Date()) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be in the future`,
      code: "VALIDATION_FUTURE_DATE",
    };
  }
  return null;
};

/**
 * Generic validator function type
 */
export type ValidatorFunction<T> = (
  value: T,
  fieldName: string
) => ValidationError | null;

/**
 * Combines multiple validators for a single field
 */
export const combineValidators = <T>(
  ...validators: ValidatorFunction<T>[]
): ValidatorFunction<T> => {
  return (value: T, fieldName: string): ValidationError | null => {
    for (const validator of validators) {
      const error = validator(value, fieldName);
      if (error) {
        return error;
      }
    }
    return null;
  };
};

/**
 * Validates an object against a schema of validators
 */
export const validateObject = <T extends Record<string, unknown>>(
  obj: T,
  schema: Record<keyof T, ValidatorFunction<T[keyof T]>>
): ValidationResult => {
  const errors: ValidationError[] = [];

  for (const [field, validator] of Object.entries(schema)) {
    const value = obj[field as keyof T];
    const error = validator(value, field);
    if (error) {
      errors.push(error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Creates a validation schema for trading configuration
 */
export const createTradingConfigValidationSchema = () => ({
  maxPositions: combineValidators(
    (value: number) => validateRequired(value, "Max Positions"),
    (value: number) => validateMinNumber(value, 1, "Max Positions"),
    (value: number) => validateMaxNumber(value, 100, "Max Positions")
  ),
  riskPerTrade: combineValidators(
    (value: number) => validateRequired(value, "Risk Per Trade"),
    (value: number) => validatePercentage(value, "Risk Per Trade")
  ),
  stopLossPercentage: combineValidators(
    (value: number) => validateRequired(value, "Stop Loss Percentage"),
    (value: number) => validatePercentage(value, "Stop Loss Percentage")
  ),
  takeProfitPercentage: combineValidators(
    (value: number) => validateRequired(value, "Take Profit Percentage"),
    (value: number) => validatePercentage(value, "Take Profit Percentage")
  ),
});
