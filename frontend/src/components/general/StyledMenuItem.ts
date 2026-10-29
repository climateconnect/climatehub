import { MenuItem, menuItemClasses } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  color: "primary",
  textAlign: "center",
  fontWeight: 600,
  [`&.${menuItemClasses.selected}`]: {
    color: theme.palette.primary.contrastText,
    backgroundColor: `${theme.palette.primary.main} !important`,
  },
}));

export default StyledMenuItem;
