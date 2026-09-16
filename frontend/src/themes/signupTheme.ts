import { createTheme } from "@mui/material";
import { coreTheme } from "./theme";

export const themeSignUp = createTheme(coreTheme, {
  components: {
    MuiButton: {
      styleOverrides: {
        containedSizeMedium: {
          borderRadius: 3,
          paddingLeft: coreTheme.spacing(4),
          paddingRight: coreTheme.spacing(4),
          paddingTop: coreTheme.spacing(1),
          paddingBottom: coreTheme.spacing(1),
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: "3.125rem 4.0625rem", // 50px 65px on 16px base
          boxShadow: "inset 1px 1px 6px #00000014, 6px 4px 10px #00000029",
          borderRadius: "3.75rem", // 60px on 16px base
          [theme.breakpoints.down("sm")]: {
            padding: "1.5rem 1.25rem", // 24px 20px
            borderRadius: "1.25rem", // 20px
          },
        }),
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 0,
          paddingBottom: "0 !important", // otherwise the "last child" rule will overwrite the padding 0 rule
          margin: 0,
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: "underline",
        },
      },
    },

    MuiTypography: {
      styleOverrides: {
        h1: {
          letterSpacing: 0,
          fontWeight: "bold",
          fontSize: "2.5rem", // 40 px on 16px base
          textAlign: "left",
          marginBottom: "0.5rem",
        },
        h2: {
          letterSpacing: 0,
          fontWeight: "bold",
          fontSize: "1.875rem", // 30 px on 16px base
          textAlign: "left",
          marginBottom: "0.5rem",
        },
        h3: {
          letterSpacing: 0,
          fontSize: "1.25rem", // 20 px on 16px base
          textAlign: "left",
          marginBottom: "0.5rem",
        },
        subtitle1: {
          fontSize: "1rem", // 16 px on 16px base
        },
      },
    },
  },
});

// assign object to a variable before default export
const signupTheme = { themeSignUp };

export default signupTheme;
