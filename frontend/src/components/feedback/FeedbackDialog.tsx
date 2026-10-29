import { Button, Checkbox, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import React, { useContext, useState } from "react";
import getTexts from "../../../public/texts/texts";
import UserContext from "../context/UserContext";
import GenericDialog from "./../dialogs/GenericDialog";

const FeedbackText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const FeedbackTextField = styled(TextField)({
  width: "100%",
});

const FeedbackCheckbox = styled(Checkbox)(({ theme }) => ({
  marginLeft: theme.spacing(-1),
}));

const SendButton = styled(Button)(({ theme }) => ({
  marginTop: theme.spacing(2),
  float: "right",
}));

export default function FeedbackDialog({
  onClose,
  open,
  title,
  inputLabel,
  maxLength,
  className,
}: FeedbackDialogProps) {
  const [element, setElement] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState("");
  const { locale, user } = useContext(UserContext);
  const texts = getTexts({ page: "communication", locale: locale });
  const handleClose = () => {
    onClose();
    setElement("");
  };

  const onSend = (event) => {
    event.preventDefault();
    const data = {
      message: element,
      email_address: email,
      send_response: checked,
    };
    onClose(data);
    setElement("");
  };

  const handleChange = (event) => {
    setElement(event.target.value);
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  return (
    <GenericDialog onClose={handleClose} open={open} title={title}>
      <div className={className}>
        <form onSubmit={onSend}>
          <FeedbackText>{texts.send_us_your_feedback_about_climate_connect}</FeedbackText>
          <FeedbackTextField
            multiline
            label={inputLabel}
            autoFocus={true}
            variant="outlined"
            onChange={handleChange}
            value={element}
            inputProps={{ maxLength: maxLength }}
            rows={4}
            maxRows={15}
            required
          />
          <FeedbackCheckbox
            id={"feedbackcheckbox"}
            checked={checked}
            size="small"
            onChange={(e) => setChecked(e.target.checked)}
          />
          <label htmlFor={"feedbackcheckbox"}>
            {texts.please_send_me_a_response_to_my_feedback}
          </label>
          {checked && !user && (
            <>
              <br />
              <TextField
                variant="outlined"
                onChange={handleEmailChange}
                /*TODO(undefined) className={classes.emailTextField} */
                value={email}
                placeholder={texts.email_address}
                type="email"
                required
              />
            </>
          )}
          <SendButton variant="contained" color="primary" type="submit">
            {texts.send}
          </SendButton>
        </form>
      </div>
    </GenericDialog>
  );
}

interface FeedbackDialogProps {
  open: boolean;
  onClose: (_text?: any) => void;
  title: string;
  inputLabel: string;
  maxLength?: number;
  className?: string;
}
