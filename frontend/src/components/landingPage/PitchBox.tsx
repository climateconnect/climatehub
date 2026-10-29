import { Theme, Typography, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext } from "react";
import getPitchElements from "../../../public/data/pitch_elements";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import SmallCloud from "../staticpages/SmallCloud";

const Root = styled("div")({
  position: "relative",
  maxWidth: 1280,
  margin: "0 auto",
});

const PitchElementsWrapper = styled("div")(({ theme }) => ({
  marginTop: theme.spacing(8),
  [theme.breakpoints.down("md")]: {
    marginTop: theme.spacing(5),
  },
}));

const PitchElementRoot = styled("div")(({ theme }) => ({
  width: "90%",
  maxWidth: 1280,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  marginBottom: theme.spacing(3),
  position: "relative",
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 500,
  },
}));

const PitchElementHeadline = styled(Typography)(({ theme }) => ({
  fontSize: 25,
  fontWeight: 600,
  marginBottom: theme.spacing(3),
}));

const PitchElementImageContainer = styled("div", {
  shouldForwardProp: (prop) => prop !== "$alternate",
})<{ $alternate?: boolean }>(({ theme, $alternate }) => ({
  flexBasis: 450,
  flexShrink: 0,
  height: 300,
  background: theme.palette.primary.light,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginRight: $alternate ? 0 : theme.spacing(3),
  marginLeft: $alternate ? theme.spacing(3) : 0,
  [theme.breakpoints.down("md")]: {
    background: "none",
    height: "auto",
    maxHeight: 230,
    margin: 0,
  },
}));

const PitchElementImage = styled("img")({
  maxWidth: "100%",
});

const PitchElementText = styled(Typography)(({ theme }) => ({
  maxWidth: 500,
  [theme.breakpoints.down("sm")]: {
    paddingBottom: theme.spacing(4),
  },
}));

const StyledSmallCloud1 = styled(SmallCloud)({
  position: "absolute",
  top: -100,
  width: 120,
  height: 80,
  left: -50,
});

const StyledSmallCloud2 = styled(SmallCloud)({
  position: "absolute",
  top: 0,
  left: 0,
});

const StyledSmallCloud3 = styled(SmallCloud)({
  position: "absolute",
  top: 0,
  right: -200,
});

const StyledSmallCloud4 = styled(SmallCloud)({
  position: "absolute",
  top: 115,
  left: -180,
  height: 80,
  width: 145,
});

const StyledSmallCloud5 = styled(SmallCloud)({
  position: "absolute",
  top: 295,
  right: -170,
  width: 120,
  height: 80,
});

const StyledSmallCloud6 = styled(SmallCloud)({
  position: "absolute",
  top: 380,
  right: -100,
});

const StyledSmallCloud7 = styled(SmallCloud)({
  position: "absolute",
  right: 40,
  top: 0,
});

const MobileCloud1 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  left: 50,
  top: -30,
  width: 120,
  height: 80,
  [theme.breakpoints.down("sm")]: {
    left: -60,
  },
}));

const MobileCloud2 = styled(SmallCloud)({
  position: "absolute",
  left: -75,
  width: 130,
  height: 80,
});

const MobileCloud3 = styled(SmallCloud)({
  position: "absolute",
  right: -80,
  top: 130,
  width: 120,
  height: 80,
});

const MobileCloud4 = styled(SmallCloud)({
  position: "absolute",
  left: -30,
  top: -80,
});

const MobileCloud5 = styled(SmallCloud)({
  position: "absolute",
  right: -50,
  top: -40,
});

const MobileCloud6 = styled(SmallCloud)(({ theme }) => ({
  position: "absolute",
  bottom: -60,
  left: 0,
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));

export default function PitchBox({ h1ClassName, className }) {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "about", locale: locale });
  const pitch_elements = getPitchElements(texts);
  const isMediumScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));
  return (
    <Root className={className}>
      {!isMediumScreen && (
        <>
          <StyledSmallCloud1 type={1} />
          <StyledSmallCloud2 type={2} reverse />
        </>
      )}
      <Typography color="primary" component="h1" className={h1ClassName}>
        {'"' + texts.effective_climate_action_only_works_with_global_collaboration + '"'}
      </Typography>
      <PitchElementsWrapper>
        <PitchElement
          image={pitch_elements[0].img}
          headline={pitch_elements[0].headline}
          text={pitch_elements[0].text}
        >
          {!isMediumScreen ? (
            <StyledSmallCloud7 type={1} reverse />
          ) : (
            <MobileCloud1 type={2} reverse />
          )}
        </PitchElement>
        <PitchElement
          alternate={!isMediumScreen}
          image={pitch_elements[1].img}
          headline={pitch_elements[1].headline}
          text={pitch_elements[1].text}
        >
          {!isMediumScreen ? (
            <>
              <StyledSmallCloud3 type={2} reverse />
              <StyledSmallCloud4 type={1} reverse />
            </>
          ) : (
            <>
              <MobileCloud2 type={2} reverse />
              <MobileCloud3 type={1} reverse />
            </>
          )}
        </PitchElement>
        <PitchElement
          image={pitch_elements[2].img}
          headline={pitch_elements[2].headline}
          text={pitch_elements[2].text}
        >
          {!isMediumScreen ? (
            <>
              <StyledSmallCloud5 type={1} reverse />
              <StyledSmallCloud6 type={2} />
            </>
          ) : (
            <>
              <MobileCloud4 type={1} />
              <MobileCloud5 type={1} reverse />
              <MobileCloud6 type={1} reverse />
            </>
          )}
        </PitchElement>
      </PitchElementsWrapper>
    </Root>
  );
}

const PitchElement = ({ image, headline, text, alternate, children }: any) => {
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "landing_page", locale: locale });
  return (
    <PitchElementRoot>
      {children}
      {!alternate && (
        <PitchElementImageContainer $alternate={alternate}>
          <PitchElementImage
            src={image}
            alt={texts.five_people_positioned_around_a_globe_connected_through_lines}
          />
        </PitchElementImageContainer>
      )}
      <div>
        <PitchElementHeadline color="primary">{headline}</PitchElementHeadline>
        <PitchElementText color="secondary">{text}</PitchElementText>
      </div>
      {alternate && (
        <PitchElementImageContainer $alternate={alternate}>
          <PitchElementImage src={image} alt="pitch Image" />
        </PitchElementImageContainer>
      )}
    </PitchElementRoot>
  );
};
