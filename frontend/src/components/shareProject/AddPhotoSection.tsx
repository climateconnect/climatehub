import { Button, IconButton, Theme, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
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
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

const ImageZoneWrapper = styled("label")({
  display: "block",
  width: "100%",
  position: "relative",
});

const ImageZone = styled("div")({
  cursor: "pointer",
  border: "1px dashed #000",
  width: "100%",
  paddingBottom: "56.25%",
  backgroundSize: "contain",
});

const PhotoIcon = styled(AddAPhotoIcon)(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing(1),
  margin: "0 auto",
  cursor: "pointer",
  fontSize: 40,
}));

const AddPhotoWrapper = styled("div")({
  position: "absolute",
  left: "calc(50% - 85px)",
  top: "calc(50% - 44px)",
});

const AddPhotoContainer = styled("div")({
  position: "absolute",
  left: "-50%",
  top: "-50%",
  width: 170,
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

  const onImageChange = async (event) => {
    const file = event.target.files[0];
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

  const onUploadImageClick = (event) => {
    event.preventDefault();
    inputFileRef.current!.click();
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
        <ImageZoneWrapper htmlFor="photo">
          <input
            type="file"
            name="photo"
            ref={inputFileRef}
            id="photo"
            style={{ display: "none" }}
            onChange={onImageChange}
            accept=".png,.jpeg,.jpg"
          />
          <ImageZone
            style={projectData.image ? { backgroundImage: `url(${projectData.image})` } : undefined}
          >
            <AddPhotoWrapper>
              <AddPhotoContainer>
                <PhotoIcon />
                <Button variant="contained" color="primary" onClick={onUploadImageClick}>
                  {!projectData.image ? texts.upload_image : texts.change_image}
                </Button>
              </AddPhotoContainer>
            </AddPhotoWrapper>
          </ImageZone>
        </ImageZoneWrapper>
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
