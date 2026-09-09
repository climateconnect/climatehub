import { Theme } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import React, { useCallback, useContext, useRef, useState } from "react";
import { func, bool, string, number, arrayOf, oneOfType } from "prop-types";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const useStyles = makeStyles<Theme, DragDropImageUploadProps>((theme) => ({
  root: {
    width: "100%",
  },
  dropZone: (props) => ({
    border: `2px dashed ${
      props.isDragActive ? theme.palette.primary.main : theme.palette.text.disabled
    }`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(4),
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s ease-in-out",
    backgroundColor: props.isDragActive ? theme.palette.primary.light + "14" : "transparent",
    "&:hover": {
      borderColor: theme.palette.primary.main,
    },
  }),
  preview: {
    maxWidth: "100%",
    maxHeight: 300,
    borderRadius: theme.shape.borderRadius,
    marginTop: theme.spacing(2),
  },
  errorText: {
    color: theme.palette.error.main,
    marginTop: theme.spacing(1),
  },
  uploadButton: {
    marginTop: theme.spacing(2),
  },
}));

type DragDropImageUploadProps = {
  onImageUpload?: (_file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
  preview?: string | null;
  label?: string;
  helperText?: string;
  error?: string;
  multiple?: boolean;
};

export default function DragDropImageUpload({
  onImageUpload,
  acceptedTypes = ACCEPTED_IMAGE_TYPES,
  maxSizeMB = 10,
  disabled = false,
  preview = null,
  label,
  helperText,
  error,
  multiple = false,
}: DragDropImageUploadProps) {
  const classes = useStyles({ isDragActive: false });
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });

  const [isDragActive, setIsDragActive] = useState(false);
  const [internalPreview, setInternalPreview] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activePreview = preview !== undefined ? preview : internalPreview;
  const activeError = error !== undefined ? error : internalError;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!acceptedTypes.includes(file.type)) {
        return texts.please_upload_either_a_png_or_a_jpg_file;
      }
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return `File size exceeds ${maxSizeMB}MB limit.`;
      }
      return null;
    },
    [acceptedTypes, maxSizeMB, texts]
  );

  const processFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setInternalError(validationError);
        return;
      }
      setInternalError(null);
      const objectUrl = URL.createObjectURL(file);
      setInternalPreview(objectUrl);
      onImageUpload?.(file);
    },
    [validateFile, onImageUpload]
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragActive(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      processFile(file);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  };

  const activeClasses = { ...classes, isDragActive };

  return (
    <div className={classes.root}>
      {label && (
        <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>{label}</label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleInputChange}
        style={{ display: "none" }}
        multiple={multiple}
        disabled={disabled}
        aria-label={label || "Upload image"}
      />
      <div
        className={activeClasses.dropZone}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-disabled={disabled}
      >
        <CloudUploadIcon style={{ fontSize: 48, color: "text.disabled", marginBottom: 8 }} />
        <div>{texts.upload_an_image || "Upload an image"}</div>
        {helperText && (
          <div style={{ fontSize: 12, color: "text.secondary", marginTop: 4 }}>{helperText}</div>
        )}
      </div>
      {activePreview && <img src={activePreview} alt="Preview" className={classes.preview} />}
      {activeError && (
        <div className={classes.errorText} role="alert">
          {activeError}
        </div>
      )}
    </div>
  );
}

DragDropImageUpload.propTypes = {
  onImageUpload: func,
  acceptedTypes: arrayOf(string),
  maxSizeMB: oneOfType([number, string]),
  disabled: bool,
  preview: oneOfType([string, bool]),
  label: string,
  helperText: string,
  error: string,
  multiple: bool,
};
