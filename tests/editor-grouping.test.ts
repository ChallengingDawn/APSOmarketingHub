import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expandSelection,
  groupCount,
  groupNodes,
  groupSiblings,
  isWholeGroup,
  moveGroup,
  ungroupNodes,
  type Groupable,
} from "../src/lib/editor/grouping";

const n = (id: string, x = 0, y = 0, groupId?: string, locked?: boolean): Groupable => ({
  id, x, y, ...(groupId ? { groupId } : {}), ...(locked ? { locked } : {}),
});

test("selecting one member selects the group", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 10, 0, "g1"), n("c", 20, 0)];
  assert.deepEqual(expandSelection(nodes, ["a"]), ["a", "b"]);
  assert.deepEqual(expandSelection(nodes, ["c"]), ["c"], "an ungrouped node is itself");
});

test("the expanded selection comes back in document order", () => {
  // So the selection reads the same way the layer list does.
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0), n("c", 0, 0, "g1")];
  assert.deepEqual(expandSelection(nodes, ["c"]), ["a", "c"]);
});

test("two groups in one selection both come whole", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1"), n("c", 0, 0, "g2"), n("d", 0, 0, "g2"), n("e")];
  assert.deepEqual(expandSelection(nodes, ["a", "d"]), ["a", "b", "c", "d"]);
});

test("grouping needs two nodes - a group of one would be invisible", () => {
  const nodes = [n("a"), n("b")];
  assert.equal(groupNodes(nodes, ["a"], "g1"), nodes, "unchanged, same array");
  const grouped = groupNodes(nodes, ["a", "b"], "g1");
  assert.deepEqual(grouped.map((x) => x.groupId), ["g1", "g1"]);
});

test("a node joining a new group leaves its old one", () => {
  // A node in two groups is a tree, and this is deliberately not one.
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1"), n("c")];
  const out = groupNodes(nodes, ["b", "c"], "g2");
  // b and c are g2; a came along because selecting b selected its group.
  assert.equal(out.find((x) => x.id === "b")?.groupId, "g2");
  assert.equal(out.find((x) => x.id === "c")?.groupId, "g2");
  assert.equal(out.find((x) => x.id === "a")?.groupId, "g2", "the whole old group moved across");
});

test("ungrouping removes the property rather than emptying it", () => {
  // An empty string would still read as "in a group" to anything truthy-
  // checking it.
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1")];
  const out = ungroupNodes(nodes, ["a"]);
  assert.equal("groupId" in out[0], false);
  assert.equal("groupId" in out[1], false, "ungrouping a member ungroups the group");
});

test("ungrouping something that was never grouped changes nothing", () => {
  const nodes = [n("a"), n("b")];
  const out = ungroupNodes(nodes, ["a", "b"]);
  assert.deepEqual(out, nodes);
});

test("the siblings are the rest of the group, not the node itself", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1"), n("c", 0, 0, "g1"), n("d")];
  assert.deepEqual(groupSiblings(nodes, "b").map((x) => x.id), ["a", "c"]);
  assert.deepEqual(groupSiblings(nodes, "d"), []);
});

test("moving one member moves the others by the same distance", () => {
  const nodes = [n("a", 10, 10, "g1"), n("b", 50, 20, "g1"), n("c", 99, 99)];
  const out = moveGroup(nodes, "a", 5, -3);
  assert.deepEqual([out[1].x, out[1].y], [55, 17]);
  // The dragged node is not moved here: Konva has already moved it, and
  // moving it again would double the drag.
  assert.deepEqual([out[0].x, out[0].y], [10, 10]);
  assert.deepEqual([out[2].x, out[2].y], [99, 99], "an outsider does not move");
});

test("a locked member of a group stays where it is", () => {
  // Lock means "do not let me move this by accident", and a lock a group can
  // override is not a lock.
  const nodes = [n("a", 0, 0, "g1"), n("b", 50, 50, "g1", true)];
  const out = moveGroup(nodes, "a", 10, 10);
  assert.deepEqual([out[1].x, out[1].y], [50, 50]);
});

test("a move of nothing is not a change", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1")];
  assert.equal(moveGroup(nodes, "a", 0, 0), nodes, "same array, so no history entry");
});

test("the Ungroup button appears only for a whole group", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1"), n("c")];
  assert.equal(isWholeGroup(nodes, ["a", "b"]), "g1");
  assert.equal(isWholeGroup(nodes, ["a"]), null, "one node is not a group");
  assert.equal(isWholeGroup(nodes, ["a", "c"]), null, "a group plus an outsider is not a group");
  assert.equal(isWholeGroup(nodes, ["b", "c"]), null);
  assert.equal(isWholeGroup([n("x"), n("y")], ["x", "y"]), null, "two loose nodes are not a group");
});

test("a group stops existing when its members go", () => {
  const nodes = [n("a", 0, 0, "g1"), n("b", 0, 0, "g1"), n("c", 0, 0, "g2"), n("d", 0, 0, "g2")];
  assert.equal(groupCount(nodes), 2);
  assert.equal(groupCount(nodes.filter((x) => x.groupId !== "g2")), 1);
  assert.equal(groupCount([n("x")]), 0);
});
