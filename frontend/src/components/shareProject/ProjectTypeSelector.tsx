import { Card, Radio, RadioGroup, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import makeStyles from "@mui/styles/makeStyles";
import React from "react";

const useStyles = makeStyles((theme) => ({
  reset: {
    margin: 0,
    padding: 0,
    listStyleType: "none",
    width: "100%",
  },
  box: {
    borderRadius: 3,
    margin: theme.spacing(1),
    boxShadow: "3px 3px 8px #E0E0E0",
    cursor: "pointer",
    display: "flex",
    color: theme.palette.secondary.main,
    alignItems: "center",
    position: "relative",
  },
  boxActive: {
    backgroundColor: "#d7f1ef",
    border: `1px solid ${theme.palette.primary.main}`,
  },
  textBox: {
    width: 225,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginRight: theme.spacing(4),
  },
  headline: {
    fontWeight: "bold",
  },
  helpText: {
    fontSize: 14,
  },
  imageContainer: {
    width: 60,
    margin: theme.spacing(2),
    display: "flex",
    alignItems: "stretch",
    height: "100%",
  },
  image: {
    height: "100%",
    width: "100%",
  },
  radioButton: {
    position: "absolute",
    right: 0,
    top: 0,
  },
}));

const ProjectTypeBox = ({ type, value, onChange, color }) => {
  const classes = useStyles();
  const handleChangeValue = () => {
    onChange(type.type_id);
  };
  return (
    <Card
      variant="outlined"
      className={`${classes.box} ${value === type.type_id && classes.boxActive}`}
      onClick={handleChangeValue}
    >
      <div className={classes.imageContainer}>
        <img
          src={`/images/project_types/${type.type_id}.png`}
          alt={type.name}
          className={classes.image}
        />
      </div>
      <div className={classes.textBox}>
        <Typography className={classes.headline}>{type.name}</Typography>
        <Typography className={classes.helpText}>{type.help_text}</Typography>
      </div>
      <Radio
        checked={value.type_id === type.type_id}
        onChange={handleChangeValue}
        name={type.name}
        value={type.type_id}
        className={classes.radioButton}
        color={color ? color : "primary"}
      />
    </Card>
  );
};

export default function ProjectTypeSelector({ className, value, types, onChange, color }) {
  const classes = useStyles();
  return (
    <div className={className}>
      <RadioGroup>
        <Grid container component="ul" spacing={2} className={classes.reset}>
          {types.map((type) => (
            <Grid size={{ xs: 12, sm: 6, md: 6, lg: 6 }} component="li" key={type.type_id}>
              <ProjectTypeBox type={type} value={value} onChange={onChange} color={color} />
            </Grid>
          ))}
        </Grid>
      </RadioGroup>
    </div>
  );
}
