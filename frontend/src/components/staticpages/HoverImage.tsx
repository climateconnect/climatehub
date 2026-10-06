import React from "react";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const notTransient = (prop: PropertyKey) => !(typeof prop === "string" && prop.startsWith("$"));

const Wrapper = styled("div")({
  position: "relative",
  ["&:hover #hover-image-container"]: {
    transform: "scale(0.3)",
    transitionDuration: "0.5s",
    transformOrigin: "0% 100%",
  },
});

const ImageContainer = styled("div")({
  transformOrigin: "0% 100%",
  transitionDuration: "0.5s",
  backgroundSize: "contain",
  backgroundRepeat: "none",
  height: "100%",
  width: "100%",
  position: "relative",
  zIndex: 1,
});

const Image = styled("img")({
  width: "100%",
  height: "100%",
});

const BackgroundDiv = styled("div", {
  shouldForwardProp: notTransient,
})<{ $background?: string }>(({ theme, $background }) => ({
  position: "absolute",
  background: $background === "primary" ? theme.palette.primary.main : theme.palette.yellow.main,
  top: -20,
  bottom: 20,
  right: -20,
  left: 20,
  textAlign: "center",
}));

const TextDivInnerWrapper = styled("div")(({ theme }) => ({
  position: "relative",
  padding: theme.spacing(3),
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100%",
  width: "100%",
}));

const ArrowIcon = styled(ArrowBackIcon, {
  shouldForwardProp: notTransient,
})<{ $background?: string }>(({ theme, $background }) => ({
  position: "absolute",
  top: 0,
  right: 0,
  transform: "rotate(-45deg)",
  fontSize: 22,
  color: $background === "primary" ? "white" : theme.palette.primary.main,
}));

const StyledText = styled(Typography)({
  fontWeight: 600,
  fontSize: 14,
});

export default function HoverImage({ src, text, className, background }: any) {
  return (
    <div className={className}>
      <Wrapper>
        <ImageContainer id="hover-image-container" style={{ backgroundImage: `url('${src}')` }}>
          <Image src={src} alt="hover image" />
        </ImageContainer>
        <BackgroundDiv $background={background}>
          <TextDivInnerWrapper>
            <ArrowIcon $background={background} />
            {<Text text={text} />}
          </TextDivInnerWrapper>
        </BackgroundDiv>
      </Wrapper>
    </div>
  );
}

function Text({ text }) {
  return <StyledText>{text}</StyledText>;
}
