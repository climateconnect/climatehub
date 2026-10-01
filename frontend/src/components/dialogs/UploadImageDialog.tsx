import { Slider, Theme, Typography } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { func, bool, object, string, number, oneOfType } from "prop-types";
import React, { useContext, useRef, useState } from "react";
//Package AvatarEditor returns an object {default: defaultFunction} instead of a function which triggers a warning. This is why we use <AvatarEditor.default> in the exported function.
import AvatarEditor from "react-avatar-editor";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import LoadingSpinner from "../general/LoadingSpinner";
import GenericDialog from "./GenericDialog";
import { getBackgroundContrastColor } from "../../../public/lib/themeOperations";

const StyledLoadingSpinner = styled(LoadingSpinner)(({ theme }) => ({
  paddingBottom: theme.spacing(8),
}));

const TitleText = styled(Typography)(({ theme }) => ({
  marginLeft: theme.spacing(1),
  marginRight: theme.spacing(1),
  fontSize: 20,
  color: theme.palette.text.primary,
})) as typeof Typography;

const StyledSlider = styled(Slider)({
  display: "block",
  margin: "0 auto",
});

type Props = {
  onClose?;
  open?;
  imageUrl?;
  borderRadius?;
  ratio?;
  height?;
  mobileHeight?;
  mediumHeight?;
  loading?;
  loadingText?;
  PaperProps?;
};

export default function UploadImageDialog({
  onClose,
  open,
  imageUrl,
  borderRadius,
  ratio,
  height,
  mobileHeight,
  mediumHeight,
  loading,
  loadingText,
  PaperProps,
}: Props) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "general", locale: locale });
  const theme = useTheme();
  const defaultValue = 25;
  const fullScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const mediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  const smallScreen = useMediaQuery<Theme>(theme.breakpoints.down("sm"));

  const [scale, setScale] = useState(1);
  const editorRef = useRef<any>(null);

  const handleClose = () => {
    setScale(1);
    onClose();
  };

  const handleSliderChange = (e, newValue) => {
    /*Don't allow scaling down lower than 10% for usability. 
    Dividing newValue by (defaultValue/0.9) is done so that the scale===1 at default value*/
    setScale(0.1 + newValue / (defaultValue / 0.9));
  };

  const applyImage = () => {
    if (editorRef.current) {
      onClose(editorRef.current.getImage());
    }
    setScale(1);
  };

  const setEditorRef = (editor) => {
    editorRef.current = editor;
  };

  const widthToUse =
    mobileHeight && smallScreen
      ? mobileHeight * ratio
      : mediumHeight && mediumScreen
      ? mediumHeight * ratio
      : height * ratio;
  const heightToUse =
    smallScreen && mobileHeight
      ? mobileHeight
      : mediumHeight && mediumScreen
      ? mediumHeight
      : height;
  const sliderMaxWidth =
    smallScreen && mobileHeight
      ? mobileHeight * ratio + 100
      : mediumHeight && mediumScreen
      ? mediumHeight * ratio + 100
      : height * ratio + 100;

  const backgroundContrastColor = getBackgroundContrastColor(theme);
  const AvatarEditorComponent = AvatarEditor as any;
  return (
    <GenericDialog
      /*TODO(undefined) className={classes.dialog} */
      onClose={handleClose}
      aria-labelledby="simple-dialog-title"
      open={open}
      fullScreen={fullScreen}
      title={texts.upload_an_image}
      useApplyButton={true}
      applyText={texts.apply}
      onApply={applyImage}
      PaperProps={PaperProps}
    >
      {loading ? (
        <>
          <StyledLoadingSpinner isLoading />
          {loadingText && <TitleText component="p">{loadingText}</TitleText>}
        </>
      ) : (
        <div /*TODO(undefined) className={classes.dialogContent} */>
          <AvatarEditorComponent
            image={imageUrl}
            ref={setEditorRef}
            width={widthToUse}
            height={heightToUse}
            border={50}
            color={[0, 0, 0, 0.6]} // RGBA
            scale={scale}
            rotate={0}
            borderRadius={borderRadius ? borderRadius : 0}
          />
          <StyledSlider
            aria-label="Image size"
            color={backgroundContrastColor}
            defaultValue={defaultValue}
            onChange={handleSliderChange}
            style={{ maxWidth: sliderMaxWidth }}
          />
        </div>
      )}
    </GenericDialog>
  );
}

UploadImageDialog.propTypes = {
  onClose: func.isRequired,
  open: bool.isRequired,
  imageUrl: oneOfType([object, string]),
  ratio: number.isRequired,
  height: number.isRequired,
  mobileHeight: number,
  mediumHeight: number,
};
