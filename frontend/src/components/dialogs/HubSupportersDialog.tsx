import React, { useContext } from "react";
import GenericDialog from "./GenericDialog";
import { getImageUrl } from "../../../public/lib/imageOperations";
import { Link } from "@mui/material";
import { styled, useTheme } from "@mui/material/styles";
import { ClassNames } from "@emotion/react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import UserContext from "../context/UserContext";
import getTexts from "../../../public/texts/texts";
import { Supporter } from "../../types";

type HubSupportersDialogProps = {
  supporters: Supporter[];
  open: boolean;
  onClose: () => void;
  hubName: string;
  hubUrl?: string;
};

const CarouselEntry = styled("div")(({ theme }) => ({
  backgroundColor: "#F7F7F7",
  padding: "10px",
  display: "flex",
  justifyContent: "left",
  marginBottom: theme.spacing(2),
  border: "1px solid #E0E0E0",
  borderRadius: "14px",
}));

const ItemContainer = styled("div")({
  display: "flex",
  alignItems: "center",
  gap: "15px",
});

const SupporterImg = styled("img")({
  borderRadius: "50%",
});

const supporterNameStyles = {
  fontSize: "16px",
  fontWeight: "600",
  overflow: "hidden",
  color: "black",
  margin: 0,
  wordBreak: "break-word",
} as const;

const SupporterLink = styled(Link)(supporterNameStyles);

const SupporterName = styled("p")(supporterNameStyles);

const SupporterSubtitle = styled("p")({
  margin: 0,
  fontSize: "15px",
  fontWeight: "normal",
  color: "#484848",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const SupporterImgStandaloneContainer = styled("div")({
  width: "100%",
  height: "100%",
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

const Donate = styled("div")(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
  fontWeight: "600",
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(2),
  textAlign: "center",
  fontSize: "17px",
  paddingTop: "5px",
}));

const HubSupportersDialog = ({
  supporters,
  open,
  onClose,
  hubName,
  hubUrl,
}: HubSupportersDialogProps) => {
  const theme = useTheme();
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale });
  const donateText = getTexts({ page: "donate", locale: locale });

  const handleClose = () => {
    onClose();
  };

  const HubSupporterCarouselEntry = ({ supporter }) => (
    <CarouselEntry key={supporter.name}>
      {supporter?.standalone_image ? (
        <SupporterImgStandaloneContainer>
          <SupporterImgStandalone
            src={getImageUrl(supporter.standalone_image)}
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
            <SupporterName>{supporter?.name}</SupporterName>
            <SupporterSubtitle>{supporter.subtitle}</SupporterSubtitle>
          </div>
        </ItemContainer>
      )}
    </CarouselEntry>
  );

  return (
    <ClassNames>
      {({ css }) => {
        // GenericDialog still takes class names; "&&" keeps these winning over its own title/close styles.
        const dialogTitleClass = css({
          "&&": {
            color: theme.palette.background.default_contrastText,
            marginRight: 0,
            textAlign: "center",
            fontSize: "17px",
            fontWeight: "600",
            paddingTop: "5px",
          },
        });
        const closeButtonRightClass = css({
          "&&": {
            alignSelf: "flex-start",
            marginTop: "-5px",
            marginRight: "-10px",
            padding: 0,
            color: theme.palette.background.default_contrastText,
            "& svg": {
              fontSize: "17px",
            },
          },
        });
        return (
          <GenericDialog
            onClose={handleClose}
            closeButtonRightSide
            open={open}
            title={texts.all_supporters_and_sponsoring_members + " " + hubName}
            titleTextClassName={dialogTitleClass}
            closeButtonRightStyle={closeButtonRightClass}
            applyText={donateText.donate_now}
            buttonAsLink={getLocalePrefix(locale) + "/donate"}
            useApplyButton
            showApplyAtBottom
          >
            {supporters?.length > 0 &&
              supporters.map((supporter) => {
                const baseUrl = `${getLocalePrefix(locale)}/organizations/${
                  supporter?.organization_url_slug
                }`;
                const organizationUrl = hubUrl ? `${baseUrl}?hub=${hubUrl}` : baseUrl;
                return (
                  <>
                    {supporter?.organization_url_slug ? (
                      <SupporterLink href={organizationUrl} underline="none">
                        <HubSupporterCarouselEntry supporter={supporter} />
                      </SupporterLink>
                    ) : (
                      <HubSupporterCarouselEntry supporter={supporter} />
                    )}
                  </>
                );
              })}

            <Donate>{texts.would_you_like_to_support_the_ClimateHub}</Donate>
          </GenericDialog>
        );
      }}
    </ClassNames>
  );
};

export default HubSupportersDialog;
