import { SortedQueue } from "./sorted-queue";

describe("SortedQueue", () => {
  type Note = {
    name: string;
    time: number;
  };
  it("should add items in sorted order", () => {
    const queue = new SortedQueue<number>((a, b) => a - b);
    queue.push(3);
    queue.push(1);
    queue.push(2);
    expect(queue.size()).toBe(3);
    expect(queue.peek()).toBe(1);
  });

  it("should remove items in sorted order", () => {
    const queue = new SortedQueue<number>((a, b) => a - b);
    queue.push(1);
    queue.push(3);
    queue.push(2);
    expect(queue.pop()).toBe(1);
    expect(queue.pop()).toBe(2);
    expect(queue.pop()).toBe(3);
    expect(queue.size()).toBe(0);
  });

  it("should handle objects with custom comparators", () => {
    const queue = new SortedQueue<Note>((a, b) => a.time - b.time);
    queue.push({ name: "C", time: 25 });
    queue.push({ name: "D", time: 30 });
    queue.push({ name: "E", time: 20 });
    expect(queue.size()).toBe(3);
    expect(queue.peek()?.name).toBe("E");
  });

  it("should remove objects", () => {
    const queue = new SortedQueue<Note>((a, b) => a.time - b.time);
    queue.push({ name: "C", time: 25 });
    queue.push({ name: "D", time: 30 });
    queue.push({ name: "E", time: 20 });
    expect(queue.size()).toBe(3);
    expect(queue.removeAll((note) => note.name === "D")).toBe(true);
    expect(queue.size()).toBe(2);
    expect(queue.pop()?.name).toBe("E");
    expect(queue.removeAll((note) => note.name === "E")).toBe(false);
    expect(queue.pop()?.name).toBe("C");
  });
});
