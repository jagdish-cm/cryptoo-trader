/**
 * Form component with validation and state management
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  FormEvent,
} from "react";
import { BaseComponentProps } from "../../../types/common/base";

// Validation types
export type ValidationRule = {
  required?: boolean | string;
  minLength?: number | { value: number; message: string };
  maxLength?: number | { value: number; message: string };
  min?: number | { value: number; message: string };
  max?: number | { value: number; message: string };
  pattern?: RegExp | { value: RegExp; message: string };
  validate?: (value: any) => string | boolean;
};

export type FieldError = {
  type: string;
  message: string;
};

export type FormState = {
  values: Record<string, any>;
  errors: Record<string, FieldError | undefined>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
};

export type FormContextType = {
  state: FormState;
  register: (
    name: string,
    rules?: ValidationRule
  ) => {
    name: string;
    value: any;
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => void;
    onBlur: () => void;
    error?: string;
  };
  setValue: (name: string, value: any) => void;
  setError: (name: string, error: FieldError) => void;
  clearError: (name: string) => void;
  reset: (values?: Record<string, any>) => void;
  validate: (name?: string) => boolean;
};

const FormContext = createContext<FormContextType | null>(null);

export const useForm = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useForm must be used within a Form component");
  }
  return context;
};

// Validation utilities
const validateField = (
  value: any,
  rules: ValidationRule
): FieldError | null => {
  // Required validation
  if (rules.required) {
    const isEmpty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      const message =
        typeof rules.required === "string"
          ? rules.required
          : "This field is required";
      return { type: "required", message };
    }
  }

  // Skip other validations if value is empty and not required
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // String length validations
  if (typeof value === "string") {
    if (rules.minLength) {
      const minLength =
        typeof rules.minLength === "number"
          ? rules.minLength
          : rules.minLength.value;
      const message =
        typeof rules.minLength === "object"
          ? rules.minLength.message
          : `Minimum length is ${minLength} characters`;

      if (value.length < minLength) {
        return { type: "minLength", message };
      }
    }

    if (rules.maxLength) {
      const maxLength =
        typeof rules.maxLength === "number"
          ? rules.maxLength
          : rules.maxLength.value;
      const message =
        typeof rules.maxLength === "object"
          ? rules.maxLength.message
          : `Maximum length is ${maxLength} characters`;

      if (value.length > maxLength) {
        return { type: "maxLength", message };
      }
    }
  }

  // Number validations
  if (typeof value === "number") {
    if (rules.min !== undefined) {
      const min = typeof rules.min === "number" ? rules.min : rules.min.value;
      const message =
        typeof rules.min === "object"
          ? rules.min.message
          : `Minimum value is ${min}`;

      if (value < min) {
        return { type: "min", message };
      }
    }

    if (rules.max !== undefined) {
      const max = typeof rules.max === "number" ? rules.max : rules.max.value;
      const message =
        typeof rules.max === "object"
          ? rules.max.message
          : `Maximum value is ${max}`;

      if (value > max) {
        return { type: "max", message };
      }
    }
  }

  // Pattern validation
  if (rules.pattern && typeof value === "string") {
    const pattern =
      rules.pattern instanceof RegExp ? rules.pattern : rules.pattern.value;
    const message =
      rules.pattern instanceof RegExp
        ? "Invalid format"
        : rules.pattern.message;

    if (!pattern.test(value)) {
      return { type: "pattern", message };
    }
  }

  // Custom validation
  if (rules.validate) {
    const result = rules.validate(value);
    if (typeof result === "string") {
      return { type: "validate", message: result };
    }
    if (result === false) {
      return { type: "validate", message: "Validation failed" };
    }
  }

  return null;
};

export interface FormProps extends BaseComponentProps {
  defaultValues?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  children: React.ReactNode;
  mode?: "onChange" | "onBlur" | "onSubmit";
}

/**
 * Form component with validation and state management
 */
export const Form: React.FC<FormProps> = ({
  defaultValues = {},
  onSubmit,
  children,
  mode = "onBlur",
  className = "",
  testId,
}) => {
  const [state, setState] = useState<FormState>({
    values: defaultValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
  });

  const [fieldRules, setFieldRules] = useState<Record<string, ValidationRule>>(
    {}
  );

  const register = useCallback(
    (name: string, rules: ValidationRule = {}) => {
      // Store rules for this field
      setFieldRules((prev) => ({ ...prev, [name]: rules }));

      return {
        name,
        value: state.values[name] || "",
        onChange: (
          e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          >
        ) => {
          const value =
            e.target.type === "checkbox"
              ? (e.target as HTMLInputElement).checked
              : e.target.value;

          setState((prev) => ({
            ...prev,
            values: { ...prev.values, [name]: value },
            errors:
              mode === "onChange"
                ? {
                    ...prev.errors,
                    [name]: validateField(value, rules) || undefined,
                  }
                : prev.errors,
          }));
        },
        onBlur: () => {
          setState((prev) => ({
            ...prev,
            touched: { ...prev.touched, [name]: true },
            errors:
              mode === "onBlur" || mode === "onChange"
                ? {
                    ...prev.errors,
                    [name]:
                      validateField(prev.values[name], rules) || undefined,
                  }
                : prev.errors,
          }));
        },
        error: state.touched[name] ? state.errors[name]?.message : undefined,
      };
    },
    [state.values, state.errors, state.touched, mode]
  );

  const setValue = useCallback((name: string, value: any) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
    }));
  }, []);

  const setError = useCallback((name: string, error: FieldError) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [name]: error },
    }));
  }, []);

  const clearError = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [name]: undefined },
    }));
  }, []);

  const validate = useCallback(
    (name?: string) => {
      if (name) {
        // Validate single field
        const rules = fieldRules[name];
        if (rules) {
          const error = validateField(state.values[name], rules);
          setState((prev) => ({
            ...prev,
            errors: { ...prev.errors, [name]: error || undefined },
          }));
          return !error;
        }
        return true;
      } else {
        // Validate all fields
        const newErrors: Record<string, FieldError | undefined> = {};
        let isValid = true;

        Object.entries(fieldRules).forEach(([fieldName, rules]) => {
          const error = validateField(state.values[fieldName], rules);
          newErrors[fieldName] = error || undefined;
          if (error) isValid = false;
        });

        setState((prev) => ({
          ...prev,
          errors: newErrors,
          isValid,
        }));

        return isValid;
      }
    },
    [state.values, fieldRules]
  );

  const reset = useCallback(
    (values: Record<string, any> = {}) => {
      setState({
        values: { ...defaultValues, ...values },
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: true,
      });
    },
    [defaultValues]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      // Validate all fields
      const isValid = validate();

      if (isValid) {
        await onSubmit(state.values);
      }
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const contextValue: FormContextType = {
    state,
    register,
    setValue,
    setError,
    clearError,
    reset,
    validate,
  };

  return (
    <FormContext.Provider value={contextValue}>
      <form
        onSubmit={handleSubmit}
        className={className}
        data-testid={testId}
        noValidate
      >
        {children}
      </form>
    </FormContext.Provider>
  );
};

export default Form;
