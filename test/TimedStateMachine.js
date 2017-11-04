import { expect } from "chai";
import { CommitmentState } from "./helpers/commitmentState";
import increaseTime from "./helpers/increaseTime";
import { latestTimestamp } from "./helpers/latestTime";

// always give one minute more to let testRPC settle
const START_DATE_GAP = 60;
// add this gap to Before state
const BEFORE_DURATION = 1 * 24 * 60 * 60 + START_DATE_GAP;
const WHITELIST_DURATION = 5 * 24 * 60 * 60;
const PUBLIC_DURATION = 30 * 24 * 60 * 60;

const TestTimedStateMachine = artifacts.require("TestTimedStateMachine");

contract("TimedStateMachine", () => {
  let timedStateMachine;
  let timebase;

  beforeEach(async () => {
    timebase = await latestTimestamp();
    const startDate = timebase + BEFORE_DURATION;
    timedStateMachine = await TestTimedStateMachine.new(startDate);
  });

  it("should have initial state", async () => {
    expect(await timedStateMachine.state.call()).to.be.bignumber.eq(
      CommitmentState.Before
    );
  });

  it("should have desired state ordering", async () => {
    await timedStateMachine.testStateOrdering();
  });

  it("should enter states at desired time", async () => {
    expect(
      await timedStateMachine.startOf(CommitmentState.Before)
    ).to.be.bignumber.eq(0);
    expect(
      await timedStateMachine.startOf(CommitmentState.Whitelist)
    ).to.be.bignumber.eq(timebase + BEFORE_DURATION);
    expect(
      await timedStateMachine.startOf(CommitmentState.Public)
    ).to.be.bignumber.eq(timebase + BEFORE_DURATION + WHITELIST_DURATION);
    expect(
      await timedStateMachine.startOf(CommitmentState.Finished)
    ).to.be.bignumber.eq(
      timebase + BEFORE_DURATION + WHITELIST_DURATION + PUBLIC_DURATION
    );
  });

  describe("timed transitions", () => {
    let timeDifferences;

    before(() => {
      // (note that exact time transitions cannot be testes in testRPC)
      // always give one sec more to let testRPC settle
      timeDifferences = {
        [CommitmentState.Before]: {
          [CommitmentState.Before]: Math.floor(BEFORE_DURATION / 2) - 2,
          [CommitmentState.Whitelist]: BEFORE_DURATION + 1,
          [CommitmentState.Public]: BEFORE_DURATION + WHITELIST_DURATION + 1,
          [CommitmentState.Finished]:
            BEFORE_DURATION + WHITELIST_DURATION + PUBLIC_DURATION + 1
        },
        [CommitmentState.Whitelist]: {
          [CommitmentState.Whitelist]: WHITELIST_DURATION - 5,
          [CommitmentState.Public]: WHITELIST_DURATION + 1,
          [CommitmentState.Finished]: WHITELIST_DURATION + PUBLIC_DURATION + 1
        },
        [CommitmentState.Public]: {
          [CommitmentState.Public]: PUBLIC_DURATION - 5,
          [CommitmentState.Finished]: PUBLIC_DURATION + 1
        },
        [CommitmentState.Finished]: {
          [CommitmentState.Finished]: 365 * 24 * 60 * 60 // just stay in the state forever
        }
      };
    });

    async function expectToState(oldState, newState, increaseTimeBy) {
      expect(await timedStateMachine.state.call()).to.be.bignumber.eq(oldState);
      await increaseTime(increaseTimeBy);
      await timedStateMachine.handleTimedTransitions();
      expect(await timedStateMachine.state.call()).to.be.bignumber.eq(newState);
    }

    // all Before Transitions will be implicitely tested
    const DesiredTimedTransitions = [
      [CommitmentState.Before, [CommitmentState.Before]],
      [
        CommitmentState.Whitelist,
        [
          CommitmentState.Whitelist,
          CommitmentState.Public,
          CommitmentState.Finished
        ]
      ],
      [
        CommitmentState.Public,
        [CommitmentState.Public, CommitmentState.Finished]
      ],
      [CommitmentState.Finished, [CommitmentState.Finished]]
    ];

    function getKeyByValue(object, value) {
      return Object.keys(object).find(key => object[key] === value);
    }

    for (const inStateMap of DesiredTimedTransitions) {
      for (const outState of inStateMap[1]) {
        /* eslint-disable no-loop-func */
        it(`should Before to ${getKeyByValue(
          CommitmentState,
          inStateMap[0]
        )} to ${getKeyByValue(CommitmentState, outState)}`, async () => {
          const inState = inStateMap[0];
          // we are in Before state
          await expectToState(
            CommitmentState.Before,
            inState,
            timeDifferences[CommitmentState.Before][inState]
          );
          // then go to desired state
          await expectToState(
            inState,
            outState,
            timeDifferences[inState][outState]
          );
        });
        /* eslint-enable no-loop-func */
      }
    }
  });
});
