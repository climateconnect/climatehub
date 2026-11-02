import React, { useContext, useState } from "react";
import Carousel from "react-multi-carousel";
import { Theme, useMediaQuery, Typography, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
import UserContext from "../context/UserContext";
import { getImageUrl } from "../../../public/lib/imageOperations";
import getTexts from "../../../public/texts/texts";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import AppLink from "../general/AppLink";
import HubSupportersDialog from "../dialogs/HubSupportersDialog";
import { Supporter } from "../../types";

type HubSupporter = {
  supportersList: Supporter[];
  containerClass?: string;
  mobileVersion?: boolean;
  hubName: string;
  hubUrl?: string;
};

const SliderRoot = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  borderRadius: 4,
  paddingRight: "5px",
  paddingLeft: "5px",
  paddingBottom: "20px",
  width: 320,
  [`@media (min-width: 900px) and (max-width: 1200px)`]: {
    alignSelf: "end",
  },
}));

const CarouselTitle = styled("p")(({ theme }) => ({
  color: theme.palette?.primary?.contrastText,
  fontSize: "13px",
  margin: "2px",
  textAlign: "center",
}));

// The dot list class (customDot) was passed to react-multi-carousel via `dotListClass`;
// it is now targeted through the library's own static class below this container.
const CarouselContainer = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  borderRadius: "4px",
  position: "relative",
  "& .react-multi-carousel-dot-list": {
    bottom: "-16px",
    // access the class name of the react-multi-carousel to change the dot color
    "& .react-multi-carousel-dot--active button": {
      background: "white",
    },
    "& li button": {
      width: "7px",
      height: "7px",
      border: "none",
      background: theme.palette.primary.light,
    },
  },
}));

const ItemContainer = styled("div")({
  display: "flex",
  alignItems: "center",
  gap: "15px",
});

const SupporterImg = styled("img")({
  borderRadius: "50%",
});

const SupporterImgStandaloneContainer = styled("div")({
  width: 310,
  height: 92,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
});

const SupporterImgStandalone = styled("img")({
  maxWidth: "100%",
  maxHeight: "100%",
  objectFit: "contain",
});

const supporterNameStyles = {
  fontSize: "17px",
  fontWeight: "600",
  color: "black",
  margin: 0,
  wordBreak: "break-word",
} as const;

const SupporterName = styled("p")(supporterNameStyles);

const SupporterNameLink = styled(AppLink)(supporterNameStyles);

const SupporterSubtitle = styled("p")({
  margin: 0,
  fontSize: "12px",
  fontWeight: "normal",
  color: "#484848",
  overflow: "hidden",
  wordBreak: "break-word",
});

const CarouselEntry = styled("div")(({ theme }) => ({
  padding: " 8px",
  display: "flex",
  justifyContent: "left",
  [theme.breakpoints.down("md")]: {
    padding: 0,
  },
  height: "100%",
}));

const ContainerInSmallDevices = styled(Button)(({ theme }) => ({
  display: "flex",
  gap: "20px",
  width: "100%",
  alignItems: "center",
  backgroundColor: "#EEEFEE",
  borderRadius: "4px",
  padding: "10px",
  marginBottom: theme.spacing(3),
}));

const SupporterImgSmallDevice = styled("img")({
  borderRadius: "50%",
});

const TextAlign = styled(Typography)({
  marginLeft: "auto",
});

const AllSupporters = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  color: "#484848",
  fontWeight: "600",
  fontSize: "17px",
  textTransform: "none",
  [theme.breakpoints.down("sm")]: {
    fontSize: "15px",
  },
}));

const ArrowIcon = styled(ArrowRightIcon)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const HubSupporters = ({
  supportersList,
  containerClass,
  mobileVersion,
  hubName,
  hubUrl,
}: HubSupporter) => {
  const isSmallOrMediumScreen = useMediaQuery<Theme>((theme) => theme.breakpoints.down("md"));
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const [openSupportersDialog, setOpenSupportersDialog] = useState(false);
  const toggleOpenSupportersDialog = () => {
    setOpenSupportersDialog(!openSupportersDialog);
  };

  return (
    <>
      {!isSmallOrMediumScreen && !mobileVersion ? (
        <HubSupportersSlider
          texts={texts}
          containerClass={containerClass}
          supportersList={supportersList}
        />
      ) : (
        <>
          <HubSupportersInSmallDevice
            containerClass={containerClass}
            supportersList={supportersList}
            texts={texts}
            showAllSupporters={toggleOpenSupportersDialog}
          />
          <HubSupportersDialog
            supporters={supportersList}
            open={openSupportersDialog}
            onClose={toggleOpenSupportersDialog}
            hubName={hubName}
            hubUrl={hubUrl}
          />
        </>
      )}
    </>
  );
};

export default HubSupporters;

const CarouselItem = ({ supporter }) => {
  const organizationHref = `/organizations/${supporter?.organization_url_slug}`;
  return (
    <CarouselEntry key={supporter.name}>
      {supporter?.standalone_image ? (
        <SupporterImgStandaloneContainer>
          <SupporterImgStandalone
            src={getImageUrl(supporter?.standalone_image)}
            alt={supporter.name}
          />
        </SupporterImgStandaloneContainer>
      ) : (
        <ItemContainer>
          <SupporterImg
            src={getImageUrl(supporter?.logo)}
            width={76}
            height={76}
            alt={supporter.name}
          />
          <div>
            <SupporterName>
              {supporter?.organization_url_slug ? (
                <SupporterNameLink href={organizationHref} underline="none">
                  {supporter?.name}
                </SupporterNameLink>
              ) : (
                supporter?.name
              )}
            </SupporterName>
            <SupporterSubtitle>{supporter.subtitle}</SupporterSubtitle>
          </div>
        </ItemContainer>
      )}
    </CarouselEntry>
  );
};

const HubSupportersSlider = ({ texts, containerClass, supportersList }) => {
  const responsive = {
    all: {
      breakpoint: { max: 10000, min: 0 },
      items: 1,
    },
  };
  return (
    <SliderRoot className={containerClass}>
      <CarouselTitle>{texts.the_climatehub_is_supported_by + " :"}</CarouselTitle>
      <CarouselContainer>
        <Carousel
          responsive={responsive}
          infinite={supportersList?.length > 1}
          arrows={false}
          showDots={true}
          renderDotsOutside={true}
          autoPlay={true}
          autoPlaySpeed={10000}
        >
          {supportersList?.length > 0 &&
            supportersList.map((supporter) => (
              <CarouselItem key={supporter?.organization_url_slug} supporter={supporter} />
            ))}
        </Carousel>
      </CarouselContainer>
    </SliderRoot>
  );
};

const HubSupportersInSmallDevice = ({
  containerClass,
  supportersList,
  texts,
  showAllSupporters,
}) => {
  const slicedSupporterForSmallDevice = supportersList.slice(0, 3);

  return (
    <ContainerInSmallDevices onClick={showAllSupporters} className={containerClass}>
      {supportersList?.length > 0 &&
        slicedSupporterForSmallDevice.map((supporter) => (
          <SupporterImgSmallDevice
            src={getImageUrl(supporter?.logo)}
            width={45}
            height={45}
            alt={supporter.name}
            key={supporter.name}
          />
        ))}
      <TextAlign>
        <AllSupporters>
          {texts.all_supporters} <ArrowIcon />{" "}
        </AllSupporters>
      </TextAlign>
    </ContainerInSmallDevices>
  );
};
