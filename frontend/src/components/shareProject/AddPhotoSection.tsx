import { Button, IconButton, Theme, Tooltip, Typography, useMediaQuery } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import React, { useContext, useRef, useState } from "react";
import {
  getImageDialogHeight,
  convertToJPGWithAspectRatio,
  getResizedImage,
  whitenTransparentPixels,
} from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import UploadImageDialog from "../dialogs/UploadImageDialog";
import useImageDrop from "../../hooks/useImageDrop";
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

const useStyles = makeStyles<Theme, { image?: string; isDragOver?: boolean }>((theme) => {
  return {
    imageZoneWrapper: {
      display: "block",
      width: "100%",
      position: "relative",
    },
    imageZone: (props) => ({
      cursor: "pointer",
      border: "1px dashed #000",
      width: "100%",
      paddingBottom: "56.25%",
      backgroundImage: `${props.image ? `url(${props.image})` : null}`,
      backgroundSize: "contain",
      outline: props.isDragOver ? "2px solid #1976d2" : undefined,
      outlineOffset: props.isDragOver ? "-4px" : undefined,
      backgroundColor: props.isDragOver ? "rgba(25, 118, 210, 0.08)" : "transparent",
    }),
    photoIcon: {
      display: "block",
      marginBottom: theme.spacing(1),
      margin: "0 auto",
      cursor: "pointer",
      fontSize: 40,
    },
    addPhotoWrapper: {
      position: "absolute",
      left: "calc(50% - 85px)",
      top: "calc(50% - 44px)",
    },
    addPhotoContainer: {
      position: "absolute",
      left: "-50%",
      top: "-50%",
      width: 170,
    },
  };
});

export default function AddPhotoSection({
  projectData,
  handleSetProjectData,
  className,
  subHeaderClassname,
  toolTipClassName,
  helpTexts,
  ToolTipIcon,
  open,
  handleSetOpen,
}) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "project", locale: locale });
  const [tempImage, setTempImage] = useState(projectData.image);
  const [isLoading, setIsLoading] = useState(false);
  const inputFileRef = useRef(null as HTMLInputElement | null);
  const isNarrowScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));

  const handleDialogClickOpen = (dialogName) => {
    handleSetOpen({ [dialogName]: true });
  };

  const handleImageFile = async (file: File) => {
    if (!file || !file.type || !ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      alert(texts.please_upload_either_a_png_or_a_jpg_file);
      return;
    }
    try {
      setIsLoading(true);
      handleDialogClickOpen("avatarDialog");
      const image = await convertToJPGWithAspectRatio(file);
      setTempImage(image);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    handleImageFile(file);
  };

  const { isDragOver, onDragOver, onDragLeave, onDrop, onPaste } = useImageDrop({
    onFileSelected: handleImageFile,
  });

  const classes = useStyles({ image: projectData.image, isDragOver });

  const onUploadImageClick = (event) => {
    event.preventDefault();
    inputFileRef.current!.click();
  };

  const onZoneKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputFileRef.current?.click();
    }
  };

  const handleAvatarDialogClose = async (image) => {
    handleSetOpen({ avatarDialog: false });
    if (image && image instanceof HTMLCanvasElement) {
      whitenTransparentPixels(image);
      image.toBlob(async function (blob) {
        const resizedBlob = URL.createObjectURL(blob!);
        const thumbnailBlob = await getResizedImage(
          URL.createObjectURL(blob!),
          290,
          160,
          "image/jpeg"
        );
        handleSetProjectData({
          image: resizedBlob,
          thumbnail_image: thumbnailBlob,
        });
      }, "image/jpeg");
    }
  };

  return (
    <>
      <div className={className}>
        <Typography component="h2" variant="subtitle2" className={subHeaderClassname}>
          {texts.add_photo}*
          <Tooltip title={helpTexts.addPhoto} className={toolTipClassName}>
            <IconButton size="large">
              <ToolTipIcon />
            </IconButton>
          </Tooltip>
        </Typography>
        <label htmlFor="photo" className={classes.imageZoneWrapper}>
          <input
            type="file"
            name="photo"
            ref={inputFileRef}
            id="photo"
            style={{ display: "none" }}
            onChange={onImageChange}
            accept=".png,.jpeg,.jpg"
          />
          <div
            className={classes.imageZone}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPaste={onPaste}
            onKeyDown={onZoneKeyDown}
            tabIndex={0}
            role="button"
            aria-label={!projectData.image ? texts.upload_image : texts.change_image}
            data-testid="add-photo-drop-zone"
            data-drag-over={isDragOver}
          >
            <div className={classes.addPhotoWrapper}>
              <div className={classes.addPhotoContainer}>
                <AddAPhotoIcon className={classes.photoIcon} />
                <Button variant="contained" color="primary" onClick={onUploadImageClick}>
                  {!projectData.image ? texts.upload_image : texts.change_image}
                </Button>
              </div>
            </div>
          </div>
        </label>
      </div>
      <UploadImageDialog
        onClose={handleAvatarDialogClose}
        open={open.avatarDialog}
        imageUrl={tempImage}
        borderRadius={0}
        height={isNarrowScreen ? getImageDialogHeight(window.innerWidth) : 300}
        ratio={16 / 9}
        loading={isLoading}
        loadingText={texts.processing_image_please_wait}
        PaperProps={{
          sx: {
            maxHeight: "none",
          },
        }}
      />
    </>
  );
}
