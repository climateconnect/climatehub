import { Box, Button, Link, MenuItem, MenuList, Paper, Popper, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import React, { useContext, useEffect, useRef, useState } from "react";
import Cookies from "universal-cookie";
import { appHref } from "../../../public/lib/appLink";
import getTexts from "../../../public/texts/texts";
import theme from "../../themes/theme";
import UserContext from "../context/UserContext";
import UserImage from "./UserImage";
import { getUserOrganizations } from "../../../public/lib/organizationOperations";

const WelcomeBanner = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  minWidth: 300,
  width: "100%",
  borderRadius: 5,
  border: `3px solid ${theme.palette.primary.main}`,
  color: "white",
  position: "relative",
  maxWidth: "800px",
}));

const Subsection = styled("div")(({ theme }) => ({
  // TODO(design): again want to make sure we reflect this color
  // scheme in our design system or in code. I just grabbed
  // this color from the color picker in Chrome DevTools
  background: "#f0f2f5",
  borderRadius: 4,
  padding: theme.spacing(1),
}));

const WelcomeMessage = styled("div")(({ theme }) => ({
  background: "white",
  borderRadius: "25px",
  color: theme.palette.secondary.main,
  display: "flex",
  alignItems: "center",
  width: "100%",
  // TODO: not sure about correct weight here
  fontWeight: "700",
  padding: theme.spacing(1.5),
}));

const WelcomeSubsection = styled("div")({
  display: "flex",
  alignItems: "center",
});

const ButtonContainer = styled("div")({
  display: "flex",
  justifyContent: "space-around",
});

const HoverButtonLabel = styled(Button)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const DropDownLink = styled(Link)(({ theme }) => ({
  color: theme.palette.background.default_contrastText,
}));

const ClimateHubOption = styled(MenuItem)({
  width: "100%",
}) as typeof MenuItem;

// TODO: generalize this spacing unit to be used in other places,
// for consistency.
const HorizontalSpacing = ({ children, size }) => {
  return (
    <Box sx={{ marginTop: theme.spacing(size), marginBottom: theme.spacing(size) }}>{children}</Box>
  );
};

// TODO(Piper): we should generalize these components post launch
// of ClimateHub so that they can be used across the platform.
const HoverButton = ({ items, label, startIcon }) => {
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);

  const handleOpen = (e) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <HoverButtonLabel
        aria-haspopup="true"
        color="primary"
        onClick={handleOpen}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        ref={buttonRef}
        startIcon={startIcon}
        type="submit"
      >
        {label}
        <ArrowDropDownIcon />
      </HoverButtonLabel>
      <DropDownList
        buttonRef={buttonRef}
        handleClose={handleClose}
        handleOpen={handleOpen}
        items={items}
        open={open}
      />
    </>
  );
};

const DropDownList = ({ buttonRef, handleOpen, handleClose, items, open }) => {
  const { startLoading } = useContext(UserContext);

  const handleClick = (onClick) => {
    if (onClick) {
      onClick();
    } else {
      startLoading();
    }
  };

  return (
    <Popper open={open} anchorEl={buttonRef.current}>
      <Paper onMouseEnter={handleOpen} onMouseLeave={handleClose}>
        <MenuList>
          {items?.map((item) => (
            <DropDownLink
              key={item.url_slug}
              href={item.url_slug}
              onClick={() => handleClick(item.onClick)}
              underline="hover"
            >
              <ClimateHubOption component="button">{item.name}</ClimateHubOption>
            </DropDownLink>
          ))}
        </MenuList>
      </Paper>
    </Popper>
  );
};

type Props = {
  hubUrl?: string;
  className?: any;
  hubName?: string;
  welcomeMessageLoggedIn?: string;
  welcomeMessageLoggedOut?: string;
};

export default function Dashboard({
  hubUrl,
  className,
  hubName,
  welcomeMessageLoggedIn,
  welcomeMessageLoggedOut,
}: Props) {
  const { user, locale } = useContext(UserContext);
  const texts = getTexts({
    page: "dashboard",
    locale: locale,
    user: user || undefined,
    hubName: hubName,
  });
  const [userOrganizations, setUserOrganizations] = useState(null);
  const token = new Cookies().get("auth_token");

  useEffect(() => {
    if (userOrganizations === null) {
      setUserOrganizations("");
      getUserOrganizations(token, locale).then((userOrgsFromServer) => {
        setUserOrganizations(userOrgsFromServer || []);
      });
    }
  }, []);

  const parseWelcomeMessage = (m) => {
    return m.replaceAll("${user.first_name}", user?.first_name);
  };

  const getWelcomeMessage = () => {
    //Hallo {User}, +quickInfo
    if (user) {
      return parseWelcomeMessage(
        welcomeMessageLoggedIn ? welcomeMessageLoggedIn : texts.welcome_message_logged_in
      );
    } else {
      return parseWelcomeMessage(
        welcomeMessageLoggedOut ? welcomeMessageLoggedOut : texts.welcome_message_logged_out
      );
    }
  };

  const welcomeMessage = getWelcomeMessage();

  const dashboardLink = (path: string, hash?: string) => {
    const href = hash ? `${path}#${hash}` : path;
    return appHref(href, { hubUrl, locale });
  };

  return (
    <WelcomeBanner className={className}>
      <Subsection>
        <HorizontalSpacing size={1}>
          <WelcomeSubsection>
            <UserImage user={user} />
            {/* TODO: doing some left spacing here -- trying to keep spacing directly out of the UI components, and isolated within Box components directly  */}
            <Box sx={{ marginLeft: theme.spacing(1), width: "100%" }}>
              <WelcomeMessage>
                <Typography style={{ fontWeight: "600" }}>{welcomeMessage}</Typography>
              </WelcomeMessage>
            </Box>
          </WelcomeSubsection>
        </HorizontalSpacing>

        <hr />

        <ButtonContainer>
          {/* When the user is logged out, we want to prompt them to sign up! And we don't
          show them the other controls. */}
          {user ? (
            <>
              <HoverButton
                startIcon={<AssignmentIcon />}
                label={texts.projects}
                items={[
                  {
                    name: texts.share_project,
                    url_slug: dashboardLink("/share"),
                  },
                  {
                    name: texts.my_projects,
                    url_slug: dashboardLink(`/profiles/${user.url_slug}`, "projects"),
                  },
                ]}
              />
              <HoverButton
                startIcon={<GroupAddIcon />}
                label={texts.organizations}
                items={[
                  {
                    name: texts.create_organization,
                    url_slug: dashboardLink("/createorganization"),
                  },
                  {
                    name: texts.my_organizations,
                    url_slug: dashboardLink(`/profiles/${user.url_slug}`, "organizations"),
                  },
                ]}
              />
              <HoverButton
                startIcon={<AccountCircleIcon />}
                label={texts.profile}
                items={[
                  {
                    name: texts.my_profile,
                    url_slug: dashboardLink(`/profiles/${user.url_slug}`),
                  },
                  {
                    name: texts.edit_profile,
                    url_slug: dashboardLink("/editprofile"),
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Button
                color="primary"
                href={appHref("/signup", { hubUrl, locale })}
                variant="contained"
              >
                {texts.join_now}
              </Button>
            </>
          )}
        </ButtonContainer>
      </Subsection>
    </WelcomeBanner>
  );
}
