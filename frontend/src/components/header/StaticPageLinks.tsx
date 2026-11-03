import React, { useContext } from "react";
import { getLocalePrefix } from "../../../public/lib/apiOperations";
import { getStaticPageLinks } from "../../../public/data/getStaticPageLinks";
import { Container, Link, Theme, useMediaQuery } from "@mui/material";
import { styled } from "@mui/material/styles";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import theme from "../../themes/theme";
import DropDownButton from "./DropDownButton";

const StaticPageLinksWrapper = styled("div")(({ theme }) => ({
  width: "100%",
  height: 50,
  background: theme.palette.primary.main,
}));

const StaticPageLinksContainer = styled(Container)({
  width: "100%",
  maxWidth: 1280,
  height: "100%",
});

const StaticPageLinksList = styled("div")(({ theme }) => ({
  float: "right",
  display: "inline-flex",
  height: "100%",
  alignItems: "center",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    justifyContent: "space-between",
  },
}));

const StyledStaticPageLink = styled(Link, {
  shouldForwardProp: (prop) => prop !== "$current",
})<{ $current?: boolean }>(({ theme, $current }) => ({
  paddingLeft: theme.spacing(2),
  marginLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  marginRight: theme.spacing(2),
  fontSize: 16,
  fontWeight: 600,
  textDecoration: "inherit",
  color: "white",
  [theme.breakpoints.down("sm")]: {
    padding: 0,
  },
  ...($current && { textDecoration: "underline" }),
}));

const whiteButtonProps = {
  sx: { color: "white" },
};

//Component containing the bar below the header listing all the static pages
//It's only shown if you're already on a static page (e.g. "/about")
export default function StaticPageLinks({ isCustomHub }) {
  const { locale } = useContext(UserContext);
  const isNarrowScreen = useMediaQuery<Theme>(theme.breakpoints.down("md"));

  const texts = getTexts({ page: "navigation", locale: locale });
  const STATIC_PAGE_LINKS = getStaticPageLinks(texts, locale, isCustomHub, true);
  const getLinksToShow = () => {
    if (isNarrowScreen) {
      return STATIC_PAGE_LINKS.slice(0, 2);
    } else {
      return STATIC_PAGE_LINKS;
    }
  };
  return (
    <StaticPageLinksWrapper>
      <StaticPageLinksContainer>
        <StaticPageLinksList>
          <DirectlyDisplayedLinks links={getLinksToShow()} isNarrowScreen={isNarrowScreen} />
          {isNarrowScreen && (
            <DropDownButton options={STATIC_PAGE_LINKS.slice(2)} buttonProps={whiteButtonProps}>
              {texts.more}
            </DropDownButton>
          )}
        </StaticPageLinksList>
      </StaticPageLinksContainer>
    </StaticPageLinksWrapper>
  );
}

//Contains the links that are directly shown without having to open the dropdownbutton
function DirectlyDisplayedLinks({ links, isNarrowScreen }) {
  const { locale } = useContext(UserContext);
  const localePrefix = getLocalePrefix(locale);

  //On narrow screen we're only displaying 2 links anyways. Just display them.
  if (isNarrowScreen) {
    return (
      <>
        {links.map((link, index) => {
          return <StaticPageLink link={link} key={index} />;
        })}
      </>
    );
  } else {
    const parentLinks = links.filter((link) => !link.parent_item);
    return (
      <>
        {parentLinks.map((link, index) => {
          const children = links.filter((l) => l.parent_item === link.href);
          if (children.length === 0) {
            return <StaticPageLink link={link} key={index} />;
          } else {
            return (
              //TODO: Work on dropdown button so that you can click it for the link it has
              <DropDownButton
                key={index}
                options={[link, ...children]}
                href={localePrefix + link.href}
                buttonProps={whiteButtonProps}
              >
                {link.text}
              </DropDownButton>
            );
          }
        })}
      </>
    );
  }
}

function StaticPageLink({ link }) {
  const { locale } = useContext(UserContext);
  const localePrefix = getLocalePrefix(locale);
  return (
    <StyledStaticPageLink
      href={localePrefix + link.href}
      $current={window.location.href.includes(link.href)}
      underline="hover"
    >
      {link.text}
    </StyledStaticPageLink>
  );
}
