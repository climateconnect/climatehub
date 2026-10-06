import { Link, Typography } from "@mui/material";
import { styled, ThemeProvider, useTheme } from "@mui/material/styles";
import React, { useContext } from "react";
import getTexts from "../../../../public/texts/texts";
import hubTheme from "../../../themes/hubTheme";
import UserContext from "../../context/UserContext";
import SimpleBarChart from "../SimpleBarChart";

// The spacing values come from the OUTER theme (the old makeStyles hook ran outside the
// nested hub ThemeProvider), so they are passed in as `$` props.
const Root = styled("div", {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $marginTop: string }>(({ $marginTop }) => ({
  marginTop: $marginTop,
}));

const Chart = styled(SimpleBarChart, {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $marginTop: string; $marginBottom: string }>(({ $marginTop, $marginBottom }) => ({
  marginTop: $marginTop,
  marginBottom: $marginBottom,
}));

const Sources = styled("div", {
  shouldForwardProp: (prop) => typeof prop !== "string" || !prop.startsWith("$"),
})<{ $marginTop: string }>(({ $marginTop }) => ({
  marginTop: $marginTop,
}));

export default function FoodDescription() {
  const outerTheme = useTheme();
  const chartMargin = outerTheme.spacing(2);
  const { locale } = useContext(UserContext);
  const texts = getTexts({ page: "hub", locale: locale, hubName: "Food" });

  const chart1Config = {
    unit: "kg CO2e / day",
    data: [
      {
        label: texts.meat_lover,
        value: 7.19,
      },
      {
        label: texts.low_meat_diet,
        value: 4.67,
      },
      {
        label: texts.vegetarian,
        value: 3.81,
      },
      {
        label: texts.vegan,
        value: 2.89,
      },
    ],
  };

  const chart2Config = {
    unit: "kg",
    data: [
      {
        label: texts.beef_from_beef_herd,
        value: 36.44,
      },
      {
        label: texts.beef_from_dairy_herd,
        value: 12.2,
      },
      {
        label: texts.fish_farmed,
        value: 7.61,
      },
      {
        label: texts.cheese,
        value: 6.17,
      },
      {
        label: texts.pig_meat,
        value: 5.15,
      },
      {
        label: texts.eggs,
        value: 3.24,
      },
      {
        label: texts.rice,
        value: 1.21,
      },
      {
        label: texts.oatmeal,
        value: 0.95,
      },
      {
        label: texts.potatoes,
        value: 0.63,
      },
      {
        label: texts.nuts,
        value: 0.07,
      },
    ],
  };

  return (
    <ThemeProvider theme={hubTheme}>
      <Root $marginTop={chartMargin}>
        <Typography component="h2" variant="h2">
          {texts.food_headline}
        </Typography>
        <Typography>{texts.food_introduction}</Typography>
        <Chart
          config={chart2Config}
          labelsOutSideBar
          $marginTop={chartMargin}
          $marginBottom={chartMargin}
          title={texts.emissions_per_calories_chart_title}
        />
        <Typography component="h2" variant="h2">
          {texts.vegan_most_climate_friendly}
        </Typography>
        <Typography>{texts.vegan_most_climate_friendly_text}</Typography>
        <Chart
          config={chart1Config}
          $marginTop={chartMargin}
          $marginBottom={chartMargin}
          labelsOutSideBar
          title={texts.avg_daily_co2_emissions_chart_title}
        />
        <Typography component="h2" variant="h2">
          {texts.seasonal_more_important_than_local}
        </Typography>
        <Typography>{texts.seasonal_more_important_than_local_text}</Typography>
        <Typography component="h2" variant="h2">
          {texts.food_waste}
        </Typography>
        <Typography>
          <div>
            <img src="/images/foodwaste.jpg" alt={texts.foodwaste_chart_alt} />
          </div>
          {texts.food_waste_text}
        </Typography>
        <Typography component="h2" variant="h2">
          {texts.lab_grown_meat_could_be_a_game_changer}
        </Typography>
        <Typography>{texts.lab_grown_meat_could_be_a_game_changer_text}</Typography>
        <Typography component="h2" variant="h2">
          {texts.scalable_solutions_needed}
        </Typography>
        <Typography>
          {texts.scalable_solutions_needed_text}
          <br />
          <Typography sx={{ fontWeight: 600 }}>{texts.food_call_to_action}</Typography>
        </Typography>
        <Sources $marginTop={outerTheme.spacing(6)}>
          {texts.sources}:
          <ul>
            <li>
              <Link href="https://ourworldindata.org/food-choice-vs-eating-local">
                https://ourworldindata.org/food-choice-vs-eating-local
              </Link>
            </li>
            <li>
              <Link href="https://ourworldindata.org/environmental-impacts-of-food">
                https://ourworldindata.org/environmental-impacts-of-food
              </Link>
            </li>
          </ul>
        </Sources>
      </Root>
    </ThemeProvider>
  );
}
