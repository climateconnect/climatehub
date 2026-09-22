import {
  Box,
  Button,
  Link,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Theme,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
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

const useStyles = makeStyles((theme: Theme) => {
  return {
    welcomeBanner: {
      backgroundColor: theme.palette.primary.main,
      minWidth: 300,
      width: "100%",
      borderRadius: 5,
      border: `3px solid ${theme.palette.primary.main}`,
      color: "white",
      position: "relative",
      maxWidth: "800px",
    },
    profileInner: {
      float: "left",
      position: "absolute",
      left: "0px",
      top: "0px",
      "z-index": " 1000",
      padding: "5px",
    },
    root: {
      marginBottom: theme.spacing(1.5),
      borderLeft: `5px solid ${theme.palette.primary.main}`,
    },

    userImage: {
      // TODO(design): what color should this actually be -- I
      // don't see it represented in the XD mockup? Ideally
      // it'd be from our emerging design system
      border: `1px solid #e0e0e0`,
      borderRadius: "50%",
      height: "40px",
      width: "43px",
      background: "white",
    },
    subsection: {
      // TODO(design): again want to make sure we reflect this color
      // scheme in our design system or in code. I just grabbed
      // this color from the color picker in Chrome DevTools
      background: "#f0f2f5",
      borderRadius: 4,
      padding: theme.spacing(1),
    },

    // TODO(Chris): is there a standard
    // set of Typography headings, components?
    headingText: {
      fontWeight: "bold",
      paddingLeft: theme.spacing(1),
    },

    welcomeMessage: {
      background: "white",
      borderRadius: "25px",
      color: theme.palette.secondary.main,
      display: "flex",
      alignItems: "center",
      width: "100%",
      // TODO: not sure about correct weight here
      fontWeight: "700",
      padding: theme.spacing(1.5),
    },

    welcomeSubsection: {
      display: "flex",
      alignItems: "center",
    },

    buttonContainer: {
      display: "flex",
      justifyContent: "space-around",
    },
    climateHubOption: {
      width: "100%",
    },
    buttonLabelColor: {
      color: theme.palette.background.default_contrastText,
    },
    linkText: {
      color: theme.palette.background.default_contrastText,
    },
  };
});

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
  const classes = useStyles();
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
      <Button
        aria-haspopup="true"
        className={classes.buttonLabelColor}
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
      </Button>
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
  const classes = useStyles();
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
      <Paper onMouseEnter={handleOpen} onMouseLeave={handleClose} className={classes.menu}>
        <MenuList>
          {items?.map((item) => (
            <Link
              key={item.url_slug}
              href={item.url_slug}
              onClick={() => handleClick(item.onClick)}
              underline="hover"
              className={classes.linkText}
            >
              <MenuItem component="button" className={classes.climateHubOption}>
                {item.name}
              </MenuItem>
            </Link>
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
  const classes = useStyles();
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
    <div className={`${classes.welcomeBanner} ${className}`}>
      <div className={`${classes.subsection}`}>
        <HorizontalSpacing size={1}>
          <div className={`${classes.welcomeSubsection}`}>
            <UserImage user={user} />
            {/* TODO: doing some left spacing here -- trying to keep spacing directly out of the UI components, and isolated within Box components directly  */}
            <Box sx={{ marginLeft: theme.spacing(1), width: "100%" }}>
              <div className={`${classes.welcomeMessage}`}>
                <Typography style={{ fontWeight: "600" }}>{welcomeMessage}</Typography>
              </div>
            </Box>
          </div>
        </HorizontalSpacing>

        <hr />

        <div className={`${classes.buttonContainer}`}>
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
        </div>
      </div>
    </div>
  );
}
