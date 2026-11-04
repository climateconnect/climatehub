import { Button, IconButton, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import React, { useState } from "react";
import { apiRequest } from "../../../public/lib/apiOperations";
import ConfirmDialog from "../dialogs/ConfirmDialog";

type Props = {
  organizationUrlSlug: string;
  isSuperAdmin: boolean;
  memberCount: number;
  token?: string;
  locale: any;
  texts: any;
  isTinyScreen?: boolean;
  onLeft: () => void;
  onError: (_error: string | null) => void;
};

export default function LeaveOrganizationButton({
  organizationUrlSlug,
  isSuperAdmin,
  memberCount,
  token,
  locale,
  texts,
  isTinyScreen,
  onLeft,
  onError,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClick = () => {
    if (isSuperAdmin) {
      onError(
        memberCount > 1
          ? texts.you_cant_leave_an_organization_as_the_super_admin
          : texts.you_are_the_last_member_delete_organization_instead
      );
      return;
    }
    onError(null);
    setDialogOpen(true);
  };

  const leave = async () => {
    try {
      await apiRequest({
        method: "post",
        url: `/api/organizations/${organizationUrlSlug}/leave/`,
        payload: {},
        token,
        locale,
      });
      onLeft();
    } catch (e: any) {
      if (e?.response?.status === 400) {
        // Backend returns a stable `code` for the known Super-Admin cases
        onError(
          e?.response?.data?.code === "last_member"
            ? texts.you_are_the_last_member_delete_organization_instead
            : texts.you_cant_leave_an_organization_as_the_super_admin
        );
      } else {
        onError(texts.could_not_leave_the_organization);
      }
    }
  };

  const handleClose = async (confirmed: boolean) => {
    setDialogOpen(false);
    if (confirmed) await leave();
  };

  return (
    <>
      {isTinyScreen ? (
        <IconButton onClick={handleClick} size="large" aria-label={texts.leave_team}>
          <LogoutIcon color="primary" />
        </IconButton>
      ) : (
        <Button variant="outlined" color="primary" onClick={handleClick} startIcon={<LogoutIcon />}>
          {texts.leave_team}
        </Button>
      )}
      <ConfirmDialog
        open={dialogOpen}
        onClose={handleClose}
        title={texts.do_you_really_want_to_leave_this_organization}
        text={
          <Typography>{texts.are_you_sure_that_you_want_to_leave_this_organization}</Typography>
        }
        confirmText={texts.yes}
        cancelText={texts.no}
      />
    </>
  );
}
