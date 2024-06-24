import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, FormControl, Grid, InputAdornment, InputLabel, OutlinedInput, Typography } from "@material-ui/core";
import { InputGroup, FormControl as FC } from "react-bootstrap";
import { useWeb3Context } from "src/hooks/web3Context";
import { Skeleton } from "@material-ui/lab";
import { error } from "../../slices/MessagesSlice";
import { ethers } from "ethers";
import styled from "styled-components";
import format from "date-fns/format";
import {
  changeApproval,
  claim,
  createLock,
  increaseAmount,
  increaseUnlockTime,
  withdraw,
} from "../../slices/VotingEscrowSlice";
import { isPendingTxn, txnButtonText } from "../../slices/PendingTxnsSlice";
import { commify } from "../../helpers";
import { add } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarAlt } from "@fortawesome/free-solid-svg-icons";
import DatePicker from "react-date-picker";

import "./lock.scss";
import "./datePicker.scss";

const WEEK = 7 * 86400;
const MAXTIME = 4 * 365 * 86400;

function Lock() {
  const dispatch = useDispatch();
  const { provider, address, chainID } = useWeb3Context();

  const [quantity, setQuantity] = useState("");
  const [increaseQuantity, setIncreaseQuantity] = useState("");
  const [increaseLockDate, setIncreaseLockDate] = useState(add(new Date(), { days: 7 }));
  const [stakeYear, setStakeYear] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);

  const sSquidBalance = useSelector(state => {
    return state.account.balances && state.account.balances.sohm;
  });
  const stakeAllowance = useSelector(state => {
    return (state.account.votingEscrow && state.account.votingEscrow.sSquidStake) || 0;
  });
  const isLoading = useSelector(state => {
    return state.account.loading || state.votingEscrow.loading;
  });
  const pendingTransactions = useSelector(state => {
    return state.pendingTransactions;
  });
  const lockedBalance = useSelector(state => state.votingEscrow.stake.lockedBalance);
  const unlockTime = useSelector(state => state.votingEscrow.stake.unlockTime);
  const hasLocked = useSelector(state => state.votingEscrow.stake.unlockTime !== "0");
  const reward = useSelector(state => state.votingEscrow.reward.claimable);
  const wethReward = useSelector(state => state.votingEscrow.reward.wethClaimable);
  const wsSquidRate = useSelector(state => Number(state.votingEscrow.value.wsSquid));
  const balance = useSelector(state => state.votingEscrow.stake.balance);
  const totalSupply = useSelector(state => state.votingEscrow.stake.totalSupply);

  const isLocking = Number(unlockTime) * 1000 > Date.now();

  const hasReward = Number(reward) !== 0 || Number(wethReward) !== 0;

  const setMax = () => {
    setQuantity(sSquidBalance);
  };

  const calUnlockTime = duration => {
    const unlockDate = add(new Date(), duration);
    return new Date(Math.floor(unlockDate.getTime() / 1000 / WEEK) * WEEK * 1000);
  };
  const quickDuration = [
    ["1 Week", calUnlockTime({ days: 7 })],
    ["1 Month", calUnlockTime({ months: 1 })],
    ["3 Months", calUnlockTime({ months: 3 })],
    ["6 Months", calUnlockTime({ months: 6 })],
    ["1 Year", calUnlockTime({ years: 1 })],
    ["4 Years", calUnlockTime({ seconds: MAXTIME })],
  ];

  const [selectedDuration, setSelectedDuration] = useState(0);
  const mintRatio = ((quickDuration[selectedDuration][1].getTime() - new Date()) / 1000 / MAXTIME) * wsSquidRate;

  const onApproval = async () => {
    await dispatch(changeApproval({ address, provider, networkID: chainID }));
  };

  const onStake = async isIncrease => {
    const amount = isIncrease ? increaseQuantity : quantity;

    // eslint-disable-next-line no-restricted-globals
    if (isNaN(amount) || amount === 0 || amount === "") {
      // eslint-disable-next-line no-alert
      return dispatch(error("Please enter a value!"));
    }

    let gweiValue = ethers.utils.parseUnits(amount, "gwei");
    if (gweiValue.gt(ethers.utils.parseUnits(sSquidBalance, "gwei"))) {
      return dispatch(error("You cannot lock more than your sSQUID balance."));
    }

    if (!isIncrease) {
      const unlockTime = Math.floor(quickDuration[selectedDuration][1].getTime() / 1000);
      await dispatch(createLock({ address, networkID: chainID, provider, sSQUIDAmount: gweiValue, unlockTime }));
    } else {
      await dispatch(increaseAmount({ address, networkID: chainID, provider, sSQUIDAmount: gweiValue }));
    }
  };

  const onIncreaseDuration = async () => {
    const unlockTime = Math.floor(increaseLockDate.getTime() / 1000);
    await dispatch(increaseUnlockTime({ address, networkID: chainID, provider, unlockTime }));
  };

  const onClaim = async () => {
    await dispatch(claim({ address, networkID: chainID, provider }));
  };

  const onWithdraw = async () => {
    await dispatch(withdraw({ address, networkID: chainID, provider }));
  };

  const hasAllowance = stakeAllowance > 0;
  const hasEnoughAllowance = stakeAllowance / 1_000_000_000 > Number(quantity);
  const hasEnoughIncreaseAllowance = stakeAllowance / 1_000_000_000 > Number(increaseQuantity);

  useEffect(() => {
    if (!isLoading && stakeYear === 0) {
      setStakeYear(1);
    }
  }, [isLoading, stakeYear]);

  return (
    <div style={{ maxWidth: 833, width: "100%", marginLeft: "auto", marginRight: "auto" }}>
      <Grid container spacing={2} className="stake-top-metrics">
        <Grid item xs={12} sm={6} md={6} lg={6}>
          <div className="lock-card head">
            <div className="title">Your veSQUID Balance</div>
            <div className="value">{commify(balance, 6)} veSQUID</div>
          </div>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={6}>
          <div className="lock-card head">
            <div className="title">Total veSQUID Balance</div>
            <div className="value">{commify(totalSupply, 6)} veSQUID</div>
          </div>
        </Grid>
        {isLocking && (
          <Grid item xs={12} sm={6} md={6} lg={6}>
            <Grid container direction="column" spacing={2}>
              <Grid item>
                <div className="lock-card mid">
                  <div className="title">Increase Lock Duration</div>
                  <div className="data-row">
                    <div className="position-relative flex-grow-1 d-flex align-items-center">
                      <DatePicker
                        autoFocus
                        calendarClassName="squid-calendar"
                        value={increaseLockDate}
                        minDate={add(new Date(), { days: 7 })}
                        maxDate={add(new Date(), { seconds: MAXTIME })}
                        isOpen={showCalendar}
                        onCalendarClose={() => setShowCalendar(false)}
                        onChange={date => {
                          const rounded = new Date(Math.floor(date.getTime() / 1000 / WEEK) * WEEK * 1000);
                          setIncreaseLockDate(rounded);
                        }}
                        calendarType="US"
                      />
                      <Input
                        as="button"
                        onClick={() => setShowCalendar(!showCalendar)}
                        style={{ width: "100%", textAlign: "left", fontSize: "0.875rem" }}
                      >
                        <FontAwesomeIcon icon={faCalendarAlt} className="me-3" style={{ fontSize: "1rem" }} />
                        {format(increaseLockDate, "MMM dd, yyyy")}
                      </Input>
                    </div>
                    <Button
                      variant="contained"
                      color="primary"
                      disabled={isPendingTxn(pendingTransactions, "increase_unlock_time")}
                      onClick={() => onIncreaseDuration()}
                      className="ms-2"
                    >
                      {txnButtonText(pendingTransactions, "increase_unlock_time", "Increase")}
                    </Button>
                  </div>
                </div>
              </Grid>
              <Grid item>
                <div className="lock-card mid">
                  <div className="title">Increase Lock Amount</div>
                  <div className="data-row">
                    <div className="position-relative flex-grow-1 d-flex align-items-center">
                      <Input
                        type="number"
                        min="0"
                        value={increaseQuantity}
                        onChange={e => setIncreaseQuantity(e.target.value)}
                      />
                      <Placeholder onClick={() => setIncreaseQuantity(sSquidBalance)}>Max</Placeholder>
                    </div>
                    {hasEnoughIncreaseAllowance ? (
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={isPendingTxn(pendingTransactions, "increase_amount")}
                        onClick={() => onStake(true)}
                        className="ms-2"
                      >
                        {txnButtonText(pendingTransactions, "increase_amount", "Increase")}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={isPendingTxn(pendingTransactions, "approve_staking")}
                        onClick={() => onApproval()}
                        className="ms-2"
                      >
                        {txnButtonText(pendingTransactions, "approve_staking", "Approve")}
                      </Button>
                    )}
                  </div>
                </div>
              </Grid>
            </Grid>
          </Grid>
        )}
        <Grid item xs={12} sm={isLocking ? 6 : 12}>
          <div className="lock-card reward d-flex flex-column justify-content-center">
            <div className="title">Claimable Rewards</div>
            <div className="value">{commify(reward, 6)} wsSQUID</div>
            <div className="value">{commify(wethReward, 6)} wETH</div>
            {hasReward && (
              <div>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={isPendingTxn(pendingTransactions, "claim")}
                  onClick={() => onClaim()}
                >
                  {txnButtonText(pendingTransactions, "claim", "Claim")}
                </Button>
              </div>
            )}
          </div>
        </Grid>
        <Grid item xs={12} sm={12} md={12} lg={12}>
          <div className="lock-card">
            <Grid container spacing={2} direction="column">
              {!isLoading && !hasLocked && (
                <Grid item>
                  <div className="inner-card">
                    <div className="header">Choose Locking Duration</div>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Input as="button" style={{ width: "100%", textAlign: "left", fontSize: "0.875rem" }}>
                          <FontAwesomeIcon icon={faCalendarAlt} className="me-3" style={{ fontSize: "1rem" }} />
                          {format(quickDuration[selectedDuration][1], "MMM dd, yyyy")}
                        </Input>
                      </Grid>
                      {quickDuration.map((d, idx) => {
                        return (
                          <Grid item xs={12} sm={6} key={idx}>
                            <DateButton
                              className={idx === selectedDuration ? "active" : ""}
                              onClick={() => setSelectedDuration(idx)}
                            >
                              <span>{d[0]}</span>
                              <span>{format(d[1], "MMM dd, yyyy")}</span>
                            </DateButton>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </div>
                </Grid>
              )}
              <Grid item>
                <div className="inner-card">
                  <div className="data-row">
                    {address && !hasAllowance ? (
                      <>
                        <div style={{ textAlign: "left", lineHeight: "16px" }}>
                          First time locking sSQUID?
                          <br />
                          Please approve Squid Dao to use your sSQUID for locking
                        </div>
                        <Button variant="contained" color="primary" onClick={() => onApproval()}>
                          {txnButtonText(pendingTransactions, "approve_staking", "Approve")}
                        </Button>
                      </>
                    ) : (
                      !hasLocked && (
                        <>
                          <FormControl className="ohm-input" variant="outlined" color="primary">
                            <InputLabel htmlFor="amount-input"></InputLabel>
                            <OutlinedInput
                              id="amount-input"
                              type="number"
                              placeholder="Enter an amount"
                              className="stake-input"
                              value={quantity}
                              onChange={e => setQuantity(e.target.value)}
                              labelWidth={0}
                              endAdornment={
                                <InputAdornment position="end">
                                  <Button variant="text" onClick={setMax} color="inherit">
                                    Max
                                  </Button>
                                </InputAdornment>
                              }
                            />
                          </FormControl>
                          {hasEnoughAllowance ? (
                            <Button
                              className="stake-button"
                              variant="contained"
                              color="primary"
                              disabled={isPendingTxn(pendingTransactions, "create_lock")}
                              onClick={() => onStake(false)}
                            >
                              {txnButtonText(pendingTransactions, "create_lock", "Lock sSQUID")}
                            </Button>
                          ) : (
                            <Button
                              className="stake-button"
                              variant="contained"
                              color="primary"
                              disabled={isPendingTxn(pendingTransactions, "approve_staking")}
                              onClick={() => onApproval()}
                            >
                              {txnButtonText(pendingTransactions, "approve_staking", "Approve")}
                            </Button>
                          )}
                        </>
                      )
                    )}
                  </div>
                  <div className="data-row">
                    <Typography>Your sSQUID Balance</Typography>
                    <Typography>
                      {isLoading ? <Skeleton width="100px" /> : <>{commify(sSquidBalance, 6)} sSQUID</>}
                    </Typography>
                  </div>
                  <div className="data-row">
                    <Typography>Your Locked Balance</Typography>
                    <Typography>
                      {isLoading ? <Skeleton width="100px" /> : <>{commify(lockedBalance, 6)} sSQUID</>}
                    </Typography>
                  </div>
                  {!hasLocked && (
                    <div className="data-row">
                      <Typography>Mint Ratio</Typography>
                      <Typography>
                        {isLoading ? <Skeleton width="100px" /> : <>{mintRatio.toFixed(6)} veSQUID per sSQUID</>}
                      </Typography>
                    </div>
                  )}
                  {!isLoading && hasLocked && (
                    <>
                      <div>
                        Unlock available on{" "}
                        <span style={{ color: "#7F7FD5" }}>
                          {format(new Date(Number(unlockTime) * 1000), "MMM dd, yyyy")}
                        </span>
                      </div>
                      <div className="justify-content-center mt-2">
                        <Button
                          variant="contained"
                          color="primary"
                          disabled={
                            isPendingTxn(pendingTransactions, "approve_staking") || isLocking || lockedBalance <= 0
                          }
                          onClick={onWithdraw}
                        >
                          {txnButtonText(pendingTransactions, "approve_staking", "Withdraw")}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </Grid>
            </Grid>
          </div>
        </Grid>
      </Grid>
    </div>
  );
}

const Input = styled(FC)`
  height: 2.5rem;
  color: black;
  border: 1px solid #aaa !important;
  border-radius: 40px !important;
  background-color: white;
  font-weight: bold;
  outline: none !important;
  box-shadow: none !important;
  padding-left: 20px;

  &:hover,
  &:focus,
  &:active,
  &:disabled {
    border: 1px solid #aaa !important;
  }

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const DateButton = styled.button`
  height: 2.5rem;
  color: black;
  border: none;
  border-radius: 40px !important;
  background-color: #f3f3f3;
  font-weight: bold;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;

  &:hover,
  &.active {
    border: 2px solid #7f7fd5;
  }
`;

const Placeholder = styled.span`
  position: absolute;
  right: 1.5rem;
  font-weight: bold;
  color: #7f7fd5;
  z-index: 3;
  font-size: 0.875rem;
  cursor: pointer;
`;

export default Lock;
