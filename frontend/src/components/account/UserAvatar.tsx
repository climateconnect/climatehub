import { Avatar, Theme } from "@mui/material";
import React, { ReactElement, useContext, useRef, useState } from "react";
import makeStyles from "@mui/styles/makeStyles";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import CloseIcon from "@mui/icons-material/Close";
import {
  convertToJPGWithAspectRatio,
  getResizedImage,
  whitenTransparentPixels,
} from "../../../public/lib/imageOperations";
import UploadImageDialog from "../dialogs/UploadImageDialog";
import UserContext from "../context/UserContext";
import getTexts from "../../../public/texts/texts";
import ConfirmDialog from "../dialogs/ConfirmDialog";
import useImageDrop from "../../hooks/useImageDrop";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

export interface AvatarImage {
  imageUrl?: string;
  thumbnailImageUrl?: string;
}

interface UserAvatarProps {
  mode: "read" | "edit";
  imageUrl?: string;
  thumbnailImageUrl?: string;
  alternativeText?: string;
  // eslint-disable-next-line no-unused-vars
  onAvatarChanged?: (image?: AvatarImage) => void;
}

const dimensions = 150;

const useStyles = makeStyles<Theme, { avatarImage?: string; isDragOver?: boolean }>((theme) => ({
  avatarImage: {
    width: `${dimensions}px`,
    height: `${dimensions}px`,
    border: "4px solid white",
  },
  imageOverlay: {
    position: "absolute",
    opacity: 0.4,
    backgroundColor: "white",
    width: `calc(${dimensions}px - 4px)`,
    height: `calc(${dimensions}px - 4px)`,
    borderRadius: "100px",
  },
  editIconContainer: {
    display: "flex",
    flexDirection: "row",
    position: "absolute",
    width: `${dimensions}px`,
    height: `${dimensions}px`,
    alignItems: "center",
    justifyContent: "center",
    cursor: (props) => (!props.avatarImage ? "pointer" : "default"),
    columnGap: theme.spacing(1),
    outline: (props) => (props.isDragOver ? "3px solid #1976d2" : undefined),
    outlineOffset: (props) => (props.isDragOver ? "-4px" : undefined),
    backgroundColor: (props) => (props.isDragOver ? "rgba(25, 118, 210, 0.15)" : "transparent"),
  },
  editIcon: {
    fontSize: "40px",
    cursor: "pointer",
  },
}));

export function UserAvatar(props: UserAvatarProps): ReactElement {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "account", locale: locale });

  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const closeIconRef = useRef<SVGSVGElement | null>(null);

  const [tempImage, setTempImage] = useState<string | undefined>(undefined);
  const [dialogStates, setDialogStates] = useState<{
    uploadOpen: boolean;
    confirmDeleteOpen: boolean;
  }>({ uploadOpen: false, confirmDeleteOpen: false });

  const [avatarImage, setAvatarImage] = useState<AvatarImage>({
    imageUrl: props.imageUrl,
    thumbnailImageUrl: props.thumbnailImageUrl,
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleImageFile = async (file: File) => {
    if (!file || !file.type || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      alert(texts.please_upload_either_a_png_or_a_jpg_file);
      return;
    }
    try {
      setIsLoading(true);
      setDialogStates({ ...dialogStates, uploadOpen: true });
      const compressedImage = await convertToJPGWithAspectRatio(file);
      setTempImage(() => compressedImage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onImageChanged = async (avatarEvent) => {
    const file = avatarEvent.target.files[0];
    if (!file) return;
    handleImageFile(file);
  };

  const { isDragOver, onDragOver, onDragLeave, onDrop, onPaste } = useImageDrop({
    onFileSelected: handleImageFile,
  });

  const classes = useStyles({ avatarImage: avatarImage.imageUrl, isDragOver });

  const removeAvatarImage = (confirm) => {
    if (confirm) {
      setAvatarImage({ imageUrl: undefined, thumbnailImageUrl: undefined });
      props.onAvatarChanged && props.onAvatarChanged(undefined);
    }
    setDialogStates({ ...dialogStates, confirmDeleteOpen: false });
  };

  const handleAvatarClose = async (image) => {
    setDialogStates({ ...dialogStates, uploadOpen: false });
    if (image && image instanceof HTMLCanvasElement) {
      whitenTransparentPixels(image);
      image.toBlob(async function (blob) {
        const imageUrl = URL.createObjectURL(blob!);
        const thumbnailImageUrl = await getResizedImage(
          URL.createObjectURL(blob!),
          120,
          120,
          "image/jpeg"
        );

        const image = { imageUrl, thumbnailImageUrl };
        setAvatarImage(image);
        props.onAvatarChanged && props.onAvatarChanged(image);
      }, "image/jpeg");
    }
  };

  const onClickChangeImage = (e) => {
    console.log("target", e.target);
    if (e.target === closeIconRef.current) {
      //If we clicked on the remove image button don't open the interface to change your image
      return;
    } else {
      inputFileRef.current?.click();
    }
  };

  const onZoneKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputFileRef.current?.click();
    }
  };

  return (
    <>
      <Avatar
        className={classes.avatarImage}
        alt={props.alternativeText}
        src={avatarImage.imageUrl}
      />
      {props.mode === "edit" && <div className={classes.imageOverlay} />}

      {props.mode === "edit" && (
        <div
          className={classes.editIconContainer}
          onClick={avatarImage.imageUrl ? () => void 0 : onClickChangeImage}
          onKeyDown={avatarImage.imageUrl ? undefined : onZoneKeyDown}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onPaste={onPaste}
          tabIndex={0}
          role={avatarImage.imageUrl ? undefined : "button"}
          aria-label={avatarImage.imageUrl ? undefined : texts.edit_avatar}
          data-testid="avatar-drop-zone"
          data-drag-over={isDragOver}
        >
          <AddAPhotoIcon
            className={classes.editIcon}
            aria-label={texts.edit_avatar}
            onClick={avatarImage.imageUrl ? onClickChangeImage : () => void 0}
          />
          {avatarImage.imageUrl && (
            <CloseIcon
              className={classes.editIcon}
              onClick={() => setDialogStates({ ...dialogStates, confirmDeleteOpen: true })}
              aria-label={texts.remove_avatar}
              ref={closeIconRef}
            />
          )}
        </div>
      )}

      <input
        type="file"
        name="avatarPhoto"
        id="avatarPhoto"
        ref={inputFileRef}
        style={{ display: "none" }}
        onChange={onImageChanged}
        accept=".png,.jpeg,.jpg"
      />

      <UploadImageDialog
        onClose={handleAvatarClose}
        open={dialogStates.uploadOpen}
        imageUrl={tempImage}
        borderRadius={10000}
        height={200}
        ratio={1}
        loading={isLoading}
        loadingText={texts.processing_image_please_wait}
      />

      <ConfirmDialog
        open={dialogStates.confirmDeleteOpen}
        onClose={removeAvatarImage}
        title={texts.remove_avatar}
        text={texts.do_you_really_want_to_remove_avatar}
        cancelText={texts.no}
        confirmText={texts.yes}
      />
    </>
  );
}
